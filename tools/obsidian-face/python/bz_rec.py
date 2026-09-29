# -*- coding: utf-8 -*-
"""
bz-face rec —— 录音说话人分离 + 逐轮转写（issue 509 / ADR-0213、0214；方案 C 定管线）。

密滑窗声纹曲线 + 两状态 Viterbi 解码，phase 账本断点续跑。边界来自说话人分数曲线的
跳变，不依赖 VAD 停顿；VAD 只做语音门控。管线经真值校准（is_sender 拼真录音时间加权
97.6%）；本文件由数据根 tools/rec_slide_hmm.py（校准基准，仍留存）收编进包，管线逻辑
零改动，只参数化路径（v0.5 修收编缺陷：质心目录参数化传递）。

用法（bin/bz-face.js 的 rec 子命令转发）:
  python bz_rec.py --data-root <数据根> --contact <联系人> --file <录音文件名>
                   [--ffmpeg <路径>]（音频容器转 16k wav 用；默认 ffmpeg）

- 录音 = <数据根>/<联系人>/recordings/<file>；sidecar = 同目录 <file>.turns.json
  （插件轮询它渲染进度，done 后并仓）。
- phase 账本：vad → voiceprint → transcribe → done，逐阶段落账、中断续跑只补缺口：
  * vad 完成后存语音段与窗口计划（原子写 .tmp→replace）；
  * 声纹窗逐块（500 窗）追加落账；blind（盲聚）也落进度——中断仍整段重头（嵌入不落账），
    但插件 UI 进度可见；
  * 转写逐轮落 text/emotion；
  * done 后重跑不再进这里（插件侧不再 spawn；手工重跑删 sidecar）。
  * me-only 降级落账的是与「我」质心的原始相似度（算完后统一减中位数归一）。
- 质心 = <数据根>/voiceprints/<联系人>.npz（bz-face refs 产）。降级阶梯（二人录音，
  非我即对方）：dual（me+peer 两质心）→ me-only（npz 只有 me，联系人语音样本不足）→
  blind（npz 缺失，2-means 盲聚，不映射身份，speaker=说话人0/1）。续跑时 sidecar 记录的
  mode 与本次算出的不一致（如先 me-only 跑一半、后来建了 dual 质心）→ 声纹段整体重算，
  两种口径的分数绝不混一锅。
- 协作式让行（v0.5，对齐 prep）：<数据根>/.bz-face/rec-control/<联系人>/<文件名>.control.json
  **按任务独立**（并发多条录音互不串台，也与 prep 的 control.json 无关）——出现
  {"action":"pause"} 在启动前 / 每声纹窗 / 每转写轮之间待命（进程不退出，模型不卸载）；
  {"action":"stop"} 留账本退出（退出码 0，phase 停在中途 = 插件侧「中断可续跑」）。
  坏 JSON / 未知 action 一律无指令。
- SenseVoice 逐轮转写带情感标签（轮内分片情感众数；分片 ≤25s）。
- 依赖 = 转写组（requirements-transcribe.txt：funasr 连带 torch / librosa / numpy）
  + ffmpeg（PATH 或 --ffmpeg）。
- stdout 仅供人看（进度权威在 sidecar.progress）；退出码 0 = 跑完 / 协作停止，1 = 硬失败。
"""
import argparse
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter

import numpy as np

WIN, HOP = 1.0, 0.25          # 滑窗（秒）/ 步进
K = 10.0                       # 分数增益（emission = ±K·llr）
SWITCH_COST = 3.0              # 话轮切换代价（抗单窗抖动）
MERGE_GAP = 1.5                # 同说话人间隙归并阈值
FLOOR = 0.05                   # 轮级平均 |llr| 低于此 → '?'
LLR_CHUNK = 500                # 声纹窗逐块落账粒度（进度 + 断点）
CONTROL_POLL_SECONDS = 1.0     # 让行待命轮询间隔（bz_prep.py 同款）
SAVE_TRIES = 40                # 账本原子替换重试次数（覆盖插件轮询的读句柄窗口）
SAVE_BACKOFF = 0.05            # 首发退避（秒）；逐次增长 + 抖动，总窗口数秒级

EMO_ZH = {
    "NEUTRAL": "平静", "HAPPY": "开心", "ANGRY": "生气", "SAD": "伤心",
    "FEARFUL": "紧张", "DISGUSTED": "厌恶", "SURPRISED": "惊讶", "EMO_UNKNOWN": "",
}


class StopRec(Exception):
    """控制文件出现 stop 指令：留账本退出（退出码 0，中断续跑语义不变）。"""


class LedgerBusy(Exception):
    """账本替换被插件读句柄占用且重试耗尽（ADR-0219）——给人话诊断，不抛裸 traceback。"""


def read_action(control_path):
    """rec-control.json → 'pause'|'stop'|'resume'|''。坏 JSON / 非对象 / 未知 action 一律无指令
    ——长任务绝不因半截写的控制文件而中断（bz_prep.py read_action 同款语义，自成一份免连带）。"""
    try:
        with open(control_path, encoding="utf-8") as f:
            obj = json.load(f)
    except Exception:
        return ""
    if not isinstance(obj, dict):
        return ""
    a = obj.get("action")
    return a if a in ("pause", "stop", "resume") else ""


def checkpoint(control_path, phase):
    """安全点（启动前 / 每声纹窗 / 每转写轮之间调用）：pause → 让行待命；返回 True = 收到 stop。"""
    a = read_action(control_path)
    if a == "stop":
        return True
    if a != "pause":
        return False
    print(f"已暂停（{phase}）——控制文件改 resume 或删除即继续")
    while True:
        time.sleep(CONTROL_POLL_SECONDS)
        a = read_action(control_path)
        if a == "stop":
            return True
        if a != "pause":
            print("继续")
            return False


def ck(control_path, phase):
    """checkpoint 的抛错版：stop 指令 → StopRec（主流程统一接住、留账本退出）。"""
    if checkpoint(control_path, phase):
        raise StopRec()


def ffmpeg_wav(src, ffmpeg):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    subprocess.run([ffmpeg or "ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", tmp.name], check=True)
    return tmp.name


def save(d, out_json):
    """原子落账：.tmp → os.replace，中断不会写半截 sidecar（ADR-0219）。

    Windows 上 replace 要覆盖目标就必须能删它，而 Node（插件轮询）开文件不带
    FILE_SHARE_DELETE——只要插件正持有读句柄，replace 就**确定性**被拒（WinError 5，
    实测 21/21 全拒）。故协作式重试：多次 × 短退避抖动，覆盖轮询的毫秒级句柄窗口；
    tmp 名带 pid 与序号，杜绝并发进程撞同一 tmp。重试耗尽抛 LedgerBusy（人话诊断，
    经 d["error"] 落到行上），不抛裸 traceback。
    """
    d.setdefault("progress", {})
    payload = json.dumps(d, ensure_ascii=False, indent=1)
    last = None
    for n in range(SAVE_TRIES):
        tmp = f"{out_json}.{os.getpid()}.{n}.tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(payload)
            os.replace(tmp, out_json)
            return
        except PermissionError as e:
            # 句柄占用：退避后重试（插件每次读只持有微秒级窗口）
            last = e
            try:
                os.unlink(tmp)
            except OSError:
                pass
            time.sleep(SAVE_BACKOFF * (1 + n % 4) + random.uniform(0, SAVE_BACKOFF))
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
    raise LedgerBusy(
        f"账本被其它进程占用，重试 {SAVE_TRIES} 次仍无法替换（{os.path.basename(out_json)}）"
        f"——插件轮询读取所致；重跑只补缺口，已完成的轮次不会重做"
    ) from last


def split_sensevoice(raw):
    """SenseVoice 输出 → (纯文本, 中文情感)。情感 token 取最后一个可映射的。"""
    s = str(raw or "")
    emo = ""
    for e in re.findall(r"<\|([A-Z_]+)\|>", s):
        zh = EMO_ZH.get(e, "")
        if zh:
            emo = zh
    return re.sub(r"<\|[^|>]*\|>", "", s).strip(), emo


def majority_emotion(emotions):
    """轮内分片情感众数（打平取先见）；空表按平静。"""
    if not emotions:
        return "平静"
    return Counter(emotions).most_common(1)[0][0]


def load_refs(refs_dir, contact):
    """质心降级阶梯（ADR-0213）：dual → me-only → blind。返回 (me_c, peer_c, mode, side_thr)。
    质心目录显式传参（v0.5 修收编缺陷：原版是模块级常量，收编时误成 main() 局部量）。
    side_thr = 旁音门限（ADR-0216；bz_refs 建质心时由留出样本窗级 max-sim 最小值留余量算得）。
    老 npz 没有它 → None = 本次不做旁音过滤（宁可漏滤也不误杀真原话）。"""
    p = os.path.join(refs_dir, f"{contact}.npz")
    if not os.path.exists(p):
        return None, None, "blind", None
    ref = np.load(p, allow_pickle=True)
    me = ref["me"] if "me" in ref.files else None
    peer = ref["peer"] if "peer" in ref.files else None
    thr = None
    if "meta" in ref.files:
        try:
            thr = json.loads(str(ref["meta"])).get("side_speech_threshold")
        except Exception:
            thr = None
    thr = float(thr) if isinstance(thr, (int, float)) else None
    if me is None:
        return None, None, "blind", None
    if peer is None:
        return me, None, "me-only", None
    return me, peer, "dual", thr


def two_means(vecs, iters=20, seed=42):
    """盲聚两质心（blind 模式；seed 固定保证重算确定性）。"""
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(vecs), 2, replace=False)
    c0, c1 = vecs[idx[0]].copy(), vecs[idx[1]].copy()
    for _ in range(iters):
        d0 = vecs @ c0
        d1 = vecs @ c1
        mask = d0 > d1
        if mask.all() or (~mask).all():
            break
        c0 = vecs[mask].mean(axis=0)
        c1 = vecs[~mask].mean(axis=0)
    return c0, c1


def viterbi(llr):
    """两状态解码：state0=我, state1=对方。emission=∓K·llr，切换代价 SWITCH_COST。"""
    n = len(llr)
    cost = np.array([[0.0, 0.0]] * n)
    back = np.zeros((n, 2), dtype=int)
    cost[0] = [-K * llr[0], K * llr[0]]
    for t in range(1, n):
        for s in (0, 1):
            e = (-K * llr[t]) if s == 0 else (K * llr[t])
            stay = cost[t - 1][s]
            switch = cost[t - 1][1 - s] + SWITCH_COST
            if stay <= switch:
                cost[t][s], back[t][s] = stay + e, s
            else:
                cost[t][s], back[t][s] = switch + e, 1 - s
    states = [0 if cost[-1][0] <= cost[-1][1] else 1]
    for t in range(n - 1, 0, -1):
        states.append(back[t][states[-1]])
    return list(reversed(states))


def classify_turn(mean_abs_llr, mean_max_sim, side_thr):
    """轮级归属覆写判定（ADR-0216）：返回 '?' / '其他' / None（None = 保持 Viterbi 归属）。

    - `?`：轮级平均 |llr| 低于 FLOOR = 两个质心分不开（口径不动，issue 516 Q24）。
    - `其他`（旁音）：**整轮**对「我」与联系人的相似度都低——门限来自 refs 用留出样本算的
      `side_speech_threshold`；me-only / blind / 老质心（无门限）一律不判（Q20）。
    `?` 先于旁音：口径与 v0.5 完全一致，只把本来会塞进某人嘴里的第三人语音挪出来。
    """
    if mean_abs_llr < FLOOR:
        return "?"
    if mean_max_sim is not None and side_thr is not None and mean_max_sim < side_thr:
        return "其他"
    return None


def run_pipeline(src, contact, out_json, d, refs_dir, control_path, ffmpeg):
    ck(control_path, "启动")  # stop 已在手就别起引擎——模型冷加载按分钟计，不白付
    from funasr import AutoModel
    import librosa

    me_c, peer_c, mode, side_thr = load_refs(refs_dir, contact)
    if d.get("mode") not in (None, mode):
        # 降级口径变了（如先 me-only 跑一半、后来建了 dual 质心）：llr 口径不可混，声纹段重算。
        # phase 拨回 voiceprint 强制轮次重建；turns 保留作 start 对齐回填源（重建分支按
        # start±0.01 复用旧 text/emotion，边界变了自然丢弃重转，绝不张冠李戴）
        print(f"质心模式变更（{d.get('mode')} → {mode}），声纹段重算")
        old_wins = (d.get("llr") or {}).get("wins") or []
        d["llr"] = {"wins": old_wins, "values": [], "mx": []}
        d["phase"] = "voiceprint"
        d.pop("diag", None)
    d["mode"] = mode
    if mode == "dual" and side_thr is None:
        print("质心 npz 没有旁音门限（老质心）——本次不做旁音过滤（重建质心后生效）")

    print("加载模型（vad / camp++ / sensevoice）…")
    vad = AutoModel(model="fsmn-vad", disable_update=True, log_level="error")
    emb = AutoModel(model="iic/speech_campplus_sv_zh-cn_16k-common", disable_update=True, log_level="error")
    asr = AutoModel(model="iic/SenseVoiceSmall", disable_update=True, log_level="error", device="cpu")

    wav_path = ffmpeg_wav(src, ffmpeg)
    try:
        wav, _ = librosa.load(wav_path, sr=16000, mono=True)
        dur = len(wav) / 16000.0
        d["duration_sec"] = round(dur, 1)

        # ---- 阶段 1：VAD 门控 + 窗口计划 ----
        if not (d.get("vad") or {}).get("segments"):
            ck(control_path, "vad")
            print(f"音频 {dur / 60:.1f} 分钟，VAD 门控…")
            d["phase"] = "vad"
            vres = vad.generate(input=wav_path, batch_size_s=300)
            raw = vres[0]["value"] if isinstance(vres, list) else vres["value"]
            segs = [[round(s / 1000, 3), round(e / 1000, 3)] for s, e in raw]
            wins = []
            for s, e in segs:
                t = s
                while t < e:
                    w_end = min(t + WIN, e)
                    if w_end - t >= 0.4:
                        wins.append([round(t, 3), round(w_end, 3)])
                    t += HOP
            d["vad"] = {"segments": segs}
            d["llr"] = {"wins": wins, "values": []}
            d["progress"] = {"text": f"VAD 完成，滑窗 {len(wins)} 个", "done": 0, "total": len(wins)}
            save(d, out_json)
        segs = d["vad"]["segments"]
        wins = [tuple(w) for w in d["llr"]["wins"]]
        print(f"语音段 {len(segs)}，滑窗 {len(wins)} 个（{WIN}s/{HOP}s）")

        # ---- 阶段 2：密滑窗声纹（dual 落 llr；me-only 落原始相似度；blind 只落进度不落嵌入） ----
        vals = d["llr"].setdefault("values", [])
        # 旁音判据要的是「窗级 max(sim_me, sim_peer)」（ADR-0216），llr 只是两者之差——差分了
        # 就还原不出 max，故 dual 下并行落一份 mx（一窗一个 float，与 values 等长）。
        mxs = d["llr"].setdefault("mx", []) if mode == "dual" else []
        raw_vecs = []
        resume_from = len(vals) if mode != "blind" else 0
        if mode == "dual" and len(mxs) != resume_from:
            # 老版本账本（v0.6 前没有 mx）：口径补齐只能重算声纹段——turns 作对齐源复用，
            # 边界不变则 text/emotion 照旧回填，不重跑 ASR
            print("账本缺旁音校准窗（老账本），声纹段重算一次以补齐同口径 max-sim")
            vals.clear()
            mxs.clear()
            d["llr"]["mx"] = mxs
            resume_from = 0
            d["phase"] = "voiceprint"
            d.pop("diag", None)
        if resume_from < len(wins):
            d["phase"] = "voiceprint"
            if resume_from:
                print(f"声纹窗 {resume_from}/{len(wins)} 续跑…")
            for i in range(resume_from, len(wins)):
                ck(control_path, "voiceprint")
                s, e = wins[i]
                piece = wav[int(s * 16000): int(e * 16000)]
                v = emb.generate(input=piece)[0]["spk_embedding"].detach().cpu().numpy().reshape(-1)
                v /= np.linalg.norm(v) + 1e-9
                if mode == "dual":
                    sm = float(v @ me_c)
                    sp = float(v @ peer_c)
                    vals.append(sm - sp)
                    mxs.append(max(sm, sp))
                elif mode == "me-only":
                    vals.append(float(v @ me_c))
                else:
                    raw_vecs.append(v)
                if (i + 1) % LLR_CHUNK == 0 or i + 1 == len(wins):
                    # blind 也落进度：中断仍整段重头（嵌入不落账），但插件 UI 进度可见
                    d["progress"] = {"text": f"声纹窗 {i + 1}/{len(wins)}", "done": i + 1, "total": len(wins)}
                    save(d, out_json)
                if (i + 1) % 500 == 0:
                    print(f"  声纹 {i + 1}/{len(wins)}")

        # 归一 → llr 曲线（me-only 减中位数 = 非我即对方的单侧分界）
        if mode == "me-only":
            arr = np.array(vals)
            llr = arr - float(np.median(arr))
        elif mode == "blind":
            vecs = np.array(raw_vecs)
            c0, c1 = two_means(vecs)
            llr = vecs @ c0 - vecs @ c1
        else:
            llr = np.array(vals)

        # ---- 轮次划分（声纹完成后固化；断点重入确定性一致，text/emotion 按 index 对齐保留） ----
        if d.get("phase") == "transcribe" and d.get("turns"):
            turns = d["turns"]
        else:
            spk0, spk1 = ("说话人0", "说话人1") if mode == "blind" else ("我", contact)
            states = viterbi(llr)
            mx_ok = mode == "dual" and len(mxs) == len(wins)
            turns = []
            for i, (s, e) in enumerate(wins):
                who = spk0 if states[i] == 0 else spk1
                prev = turns[-1] if turns else None
                if prev and prev["speaker"] == who and s - prev["end"] <= MERGE_GAP:
                    prev["end"] = e
                    prev["llrs"].append(llr[i])
                    if mx_ok:
                        prev["mxs"].append(mxs[i])
                else:
                    nt = {"start": s, "end": e, "speaker": who, "llrs": [llr[i]]}
                    if mx_ok:
                        nt["mxs"] = [mxs[i]]
                    turns.append(nt)
            old = d.get("turns") or []
            fixed = []
            side_n = 0
            for t in turns:
                m = float(np.mean(np.abs(t.pop("llrs"))))
                mm = float(np.mean(t.pop("mxs"))) if "mxs" in t else None
                same = len(old) > len(fixed) and abs(old[len(fixed)].get("start", -1) - t["start"]) < 0.01
                t["mean_abs_llr"] = round(m, 3)
                over = classify_turn(m, mm, side_thr)
                if over == "其他":
                    # 旁音（ADR-0216）：整轮对本对话两人的相似度都低于门限 = 第三人语音
                    # （电视 / 音乐里的人声）。留账不进仓——插件侧并仓时按 speaker 滤掉。
                    t["speaker"] = "其他"
                    t["mean_max_sim"] = round(mm, 3)
                    side_n += 1
                elif over:
                    t["speaker"] = over
                t["emotion"] = old[len(fixed)].get("emotion", "") if same else ""
                t["text"] = old[len(fixed)].get("text", "") if same else ""
                fixed.append(t)
            d["turns"] = fixed
            d["diag"] = {
                "windows": len(wins),
                "uncertain_turns": sum(1 for t in fixed if t["speaker"] == "?"),
                "side_speech_turns": side_n,
                "side_speech_threshold": side_thr,
                "avg_abs_llr": round(float(np.mean(np.abs(llr))), 3),
            }
            if side_n:
                print(f"旁音过滤：{side_n} 轮判为第三人语音（门限 {side_thr:.3f}，留账不进仓）")
            d["phase"] = "transcribe"
            d["progress"] = {"text": f"转写 0/{len(fixed)}", "done": 0, "total": len(fixed)}
            save(d, out_json)
        turns = d["turns"]

        # ---- 阶段 3：SenseVoice 逐轮转写（逐轮落账；已有 text 的轮跳过 = 只补缺口） ----
        total = len(turns)
        print(f"SenseVoice 按轮转写（长轮 25s 分片），共 {total} 轮…")
        for idx, t in enumerate(turns):
            if str(t.get("text") or "").strip():
                continue
            ck(control_path, "transcribe")
            texts, emos = [], []
            s = t["start"]
            while s < t["end"]:
                e = min(s + 25.0, t["end"])
                piece = wav[int(s * 16000): int(e * 16000)]
                if len(piece) > 4000:
                    try:
                        r = asr.generate(input=piece)
                        raw_text = r[0]["text"] if isinstance(r, list) else r["text"]
                        tx, em = split_sensevoice(raw_text)
                        if tx:
                            texts.append(tx)
                        if em:
                            emos.append(em)
                    except Exception:
                        pass
                s = e
            t["text"] = "".join(texts).strip()
            t["emotion"] = majority_emotion(emos)
            d["progress"] = {"text": f"转写 {idx + 1}/{total}", "done": idx + 1, "total": total}
            save(d, out_json)

        # ---- 收尾统计 ----
        def time_total(sp):
            return sum(t["end"] - t["start"] for t in turns if t["speaker"] == sp)

        names = ["我", contact, "?"] if mode != "blind" else ["说话人0", "说话人1", "?"]
        if mode == "dual" and contact != "其他":
            names.append("其他")  # 旁音（ADR-0216）
        d["speakers_sec"] = {k: round(time_total(k), 1) for k in names}
        d["turns_count"] = len(turns)
        d["phase"] = "done"
        d["progress"] = {"text": f"完成：{len(turns)} 轮", "done": len(turns), "total": len(turns)}
        save(d, out_json)

        mins = lambda v: f"{v / 60:.1f}分钟"
        print("\n=== 方案 C 结果 ===")
        for k, v in d["speakers_sec"].items():
            print(f"{k} {mins(v)}")
        print(f"轮次 {len(turns)} | 输出: {out_json}\n")
        print("--- 前 25 轮预览 ---")
        fmt = lambda sec: f"{int(sec // 60):02d}:{int(sec % 60):02d}"
        for t in turns[:25]:
            print(f"[{fmt(t['start'])}] {t['speaker']}·{t['emotion']}: {t['text'][:70]}")
    finally:
        os.unlink(wav_path)


def main():
    ap = argparse.ArgumentParser(description="bz-face rec：录音说话人分离 + 逐轮转写（方案 C）")
    ap.add_argument("--data-root", required=True, help="数据根（联系人目录、voiceprints 与控制文件的父目录）")
    ap.add_argument("--contact", required=True, help="联系人目录名（质心 npz 键同源）")
    ap.add_argument("--file", required=True, help="录音文件名（recordings/ 下，含扩展名）")
    ap.add_argument("--ffmpeg", default="ffmpeg", help="ffmpeg 命令 / 路径（音频转 16k wav 用；默认 ffmpeg）")
    a = ap.parse_args()

    root = os.path.abspath(a.data_root)
    if os.path.basename(a.file) != a.file or a.file in (".", ".."):
        print(f"bz-face rec：--file 收文件名（recordings/ 下，不含路径分隔）：{a.file}", file=sys.stderr)
        sys.exit(1)
    src = os.path.join(root, a.contact, "recordings", a.file)
    if not os.path.exists(src):
        print(f"bz-face rec：录音不存在：{src}", file=sys.stderr)
        sys.exit(1)
    out_json = os.path.splitext(src)[0] + ".turns.json"
    refs_dir = os.path.join(root, "voiceprints")
    # 控制文件按任务独立（并发多条录音互不串台；联系人目录名本身是合法目录名）
    control_path = os.path.join(root, ".bz-face", "rec-control", a.contact, f"{a.file}.control.json")

    d = {}
    if os.path.exists(out_json):
        try:
            with open(out_json, encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                d = loaded
        except Exception:
            d = {}
    d.setdefault("file", os.path.basename(src))
    d["contact"] = a.contact
    d["engine"] = "slide-hmm(CAM++ 1s/0.25s + viterbi k10 C3 + side-speech)"
    d.pop("error", None)

    if not shutil.which(a.ffmpeg or "ffmpeg"):
        d["phase"] = "error"
        d["error"] = f"ffmpeg 不可用：{a.ffmpeg or 'ffmpeg'}（用 --ffmpeg 指向 ffmpeg.exe，或先跑 bz-face doctor）"
        try:
            save(d, out_json)
        except LedgerBusy:
            pass
        print(f"bz-face rec：{d['error']}", file=sys.stderr)
        sys.exit(1)

    try:
        run_pipeline(src, a.contact, out_json, d, refs_dir, control_path, a.ffmpeg)
    except StopRec:
        # 协作停止：留账本退出（退出码 0）——phase 停在中途 = 插件侧「中断可续跑」
        p = d.get("progress") or {}
        d["progress"] = {"text": "已停止，重跑只补缺口", "done": p.get("done", 0), "total": p.get("total", 0)}
        try:
            save(d, out_json)
        except LedgerBusy:
            pass
        print("收到停止，已完成账本保留（重跑只补缺口）")
    except LedgerBusy as e:
        # 账本占用且重试耗尽：人话诊断落账 + stderr，不打裸 traceback（ADR-0219）
        d["phase"] = "error"
        d["error"] = str(e)
        try:
            save(d, out_json)
        except LedgerBusy:
            pass
        print(f"bz-face rec：{e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        d["phase"] = "error"
        d["error"] = f"{type(e).__name__}: {e}"
        try:
            save(d, out_json)
        except LedgerBusy:
            pass
        raise


if __name__ == "__main__":
    main()

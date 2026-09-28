# -*- coding: utf-8 -*-
"""
bz-face rec —— 录音说话人分离 + 逐轮转写（issue 509 / ADR-0213、0214；方案 C 定管线）。

密滑窗声纹曲线 + 两状态 Viterbi 解码，phase 账本断点续跑。边界来自说话人分数曲线的
跳变，不依赖 VAD 停顿；VAD 只做语音门控。管线经真值校准（is_sender 拼真录音时间加权
97.6%）；本文件由数据根 tools/rec_slide_hmm.py（校准基准，仍留存）收编进包，管线逻辑
零改动，只参数化路径。

用法（bin/bz-face.js 的 rec 子命令转发）:
  python bz_rec.py --data-root <数据根> --contact <联系人> --file <录音文件名>

- 录音 = <数据根>/<联系人>/recordings/<file>；sidecar = 同目录 <file>.turns.json
  （插件轮询它渲染进度，done 后并仓）。
- phase 账本：vad → voiceprint → transcribe → done，逐阶段落账、中断续跑只补缺口：
  * vad 完成后存语音段与窗口计划（原子写 .tmp→replace）；
  * 声纹窗逐块（500 窗）追加落账；
  * 转写逐轮落 text/emotion；
  * done 后重跑不再进这里（插件侧不再 spawn；手工重跑删 sidecar）。
  * me-only 降级落账的是与「我」质心的原始相似度（算完后统一减中位数归一）；
    blind（无质心）不落账、中断即重头（极罕见路径）。
- 质心 = <数据根>/voiceprints/<联系人>.npz（bz-face refs 产）。降级阶梯（二人录音，
  非我即对方）：dual（me+peer 两质心）→ me-only（npz 只有 me，联系人语音样本不足）→
  blind（npz 缺失，2-means 盲聚，不映射身份，speaker=说话人0/1）。
- SenseVoice 逐轮转写带情感标签（轮内分片情感众数；分片 ≤25s）。
- 依赖 = 转写组（requirements-transcribe.txt：funasr 连带 torch / librosa / numpy）+ 系统 ffmpeg。
- stdout 仅供人看（进度权威在 sidecar.progress）；退出码 0 = 跑完，1 = 硬失败。
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter

import numpy as np

WIN, HOP = 1.0, 0.25          # 滑窗（秒）/ 步进
K = 10.0                       # 分数增益（emission = ±K·llr）
SWITCH_COST = 3.0              # 话轮切换代价（抗单窗抖动）
MERGE_GAP = 1.5                # 同说话人间隙归并阈值
FLOOR = 0.05                   # 轮级平均 |llr| 低于此 → '?'
LLR_CHUNK = 500                # 声纹窗逐块落账粒度（进度 + 断点）

EMO_ZH = {
    "NEUTRAL": "平静", "HAPPY": "开心", "ANGRY": "生气", "SAD": "伤心",
    "FEARFUL": "紧张", "DISGUSTED": "厌恶", "SURPRISED": "惊讶", "EMO_UNKNOWN": "",
}


def ffmpeg_wav(src):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", tmp.name], check=True)
    return tmp.name


def save(d, out_json):
    """原子落账：.tmp → os.replace，中断不会写半截 sidecar。"""
    d.setdefault("progress", {})
    tmp = out_json + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    os.replace(tmp, out_json)


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


def load_refs(contact):
    """质心降级阶梯（ADR-0213）：dual → me-only → blind。返回 (me_c, peer_c, mode)。"""
    p = os.path.join(REFS, f"{contact}.npz")
    if not os.path.exists(p):
        return None, None, "blind"
    ref = np.load(p, allow_pickle=True)
    me = ref["me"] if "me" in ref.files else None
    peer = ref["peer"] if "peer" in ref.files else None
    if me is None:
        return None, None, "blind"
    if peer is None:
        return me, None, "me-only"
    return me, peer, "dual"


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


def run_pipeline(src, contact, out_json, d):
    from funasr import AutoModel
    import librosa

    me_c, peer_c, mode = load_refs(contact)
    d["mode"] = mode

    print("加载模型（vad / camp++ / sensevoice）…")
    vad = AutoModel(model="fsmn-vad", disable_update=True, log_level="error")
    emb = AutoModel(model="iic/speech_campplus_sv_zh-cn_16k-common", disable_update=True, log_level="error")
    asr = AutoModel(model="iic/SenseVoiceSmall", disable_update=True, log_level="error", device="cpu")

    wav_path = ffmpeg_wav(src)
    try:
        wav, _ = librosa.load(wav_path, sr=16000, mono=True)
        dur = len(wav) / 16000.0
        d["duration_sec"] = round(dur, 1)

        # ---- 阶段 1：VAD 门控 + 窗口计划 ----
        if not (d.get("vad") or {}).get("segments"):
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

        # ---- 阶段 2：密滑窗声纹（dual 落 llr；me-only 落原始相似度；blind 不落账） ----
        vals = d["llr"].setdefault("values", [])
        raw_vecs = []
        resume_from = len(vals) if mode != "blind" else 0
        if resume_from < len(wins):
            d["phase"] = "voiceprint"
            if resume_from:
                print(f"声纹窗 {resume_from}/{len(wins)} 续跑…")
            for i in range(resume_from, len(wins)):
                s, e = wins[i]
                piece = wav[int(s * 16000): int(e * 16000)]
                v = emb.generate(input=piece)[0]["spk_embedding"].detach().cpu().numpy().reshape(-1)
                v /= np.linalg.norm(v) + 1e-9
                if mode == "dual":
                    vals.append(float(v @ me_c) - float(v @ peer_c))
                elif mode == "me-only":
                    vals.append(float(v @ me_c))
                else:
                    raw_vecs.append(v)
                if (i + 1) % LLR_CHUNK == 0 or i + 1 == len(wins):
                    d["progress"] = {"text": f"声纹窗 {i + 1}/{len(wins)}", "done": i + 1, "total": len(wins)}
                    if mode != "blind":
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
            turns = []
            for i, (s, e) in enumerate(wins):
                who = spk0 if states[i] == 0 else spk1
                prev = turns[-1] if turns else None
                if prev and prev["speaker"] == who and s - prev["end"] <= MERGE_GAP:
                    prev["end"] = e
                    prev["llrs"].append(llr[i])
                else:
                    turns.append({"start": s, "end": e, "speaker": who, "llrs": [llr[i]]})
            old = d.get("turns") or []
            fixed = []
            for t in turns:
                m = float(np.mean(np.abs(t.pop("llrs"))))
                same = len(old) > len(fixed) and abs(old[len(fixed)].get("start", -1) - t["start"]) < 0.01
                t["mean_abs_llr"] = round(m, 3)
                if m < FLOOR:
                    t["speaker"] = "?"
                t["emotion"] = old[len(fixed)].get("emotion", "") if same else ""
                t["text"] = old[len(fixed)].get("text", "") if same else ""
                fixed.append(t)
            d["turns"] = fixed
            d["diag"] = {
                "windows": len(wins),
                "uncertain_turns": sum(1 for t in fixed if t["speaker"] == "?"),
                "avg_abs_llr": round(float(np.mean(np.abs(llr))), 3),
            }
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
    ap.add_argument("--data-root", required=True, help="数据根（联系人目录与 voiceprints 的父目录）")
    ap.add_argument("--contact", required=True, help="联系人目录名（质心 npz 键同源）")
    ap.add_argument("--file", required=True, help="录音文件名（recordings/ 下，含扩展名）")
    a = ap.parse_args()

    root = os.path.abspath(a.data_root)
    src = os.path.join(root, a.contact, "recordings", a.file)
    if not os.path.exists(src):
        print(f"bz-face rec：录音不存在：{src}", file=sys.stderr)
        sys.exit(1)
    out_json = os.path.splitext(src)[0] + ".turns.json"
    REFS = os.path.join(root, "voiceprints")

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
    d["contact"] = contact
    d["engine"] = "slide-hmm(CAM++ 1s/0.25s + viterbi k10 C3)"
    d.pop("error", None)
    try:
        run_pipeline(src, contact, out_json, d)
    except Exception as e:
        d["phase"] = "error"
        d["error"] = f"{type(e).__name__}: {e}"
        save(d, out_json)
        raise


if __name__ == "__main__":
    main()

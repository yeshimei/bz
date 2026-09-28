# -*- coding: utf-8 -*-
"""
bz-face refs —— 构建联系人说话人参考声纹（issue 509 / ADR-0213、0214）。

对分离（bz-face rec）的质心参考：按 chat.json type=34 消息的 who 标签（'我' / 联系人名）
给 voice/*.wav 分池，各池嵌入取均值 = 参考质心。缺 peer（联系人语音样本不足）只存 me =
me-only 模式，分离脚本按「非我即对方」降级。本文件由数据根 tools/voiceprint_refs.py 收编
进包，构建口径零改动，只参数化路径（v0.5 修收编缺陷：holdout 段调用点同步双参签名）。

用法（bin/bz-face.js 的 refs 子命令转发）:
  python bz_refs.py --data-root <数据根> --contact <联系人> [--contact <联系人> …]

- 样本源 = <数据根>/<联系人>/voice/*.wav + 同目录 chat.json 的 type=34 消息
  （bz-face export 产物；who 由预处理线还原）。每位联系人的 chat.json / voice 目录
  只读一遍（v0.5：原「我」池 / 对方池 / 校验段各读一遍是纯浪费）。
- 产出 <数据根>/voiceprints/<联系人>.npz：me 质心（+peer 质心）+ meta 元信息
  （原子写 .tmp.npz → os.replace，中断不留半截 npz）。
- 增量构建（v0.5）：meta 存全局输入指纹（全部联系人的 chat.json 哈希 + voice 清单 +
  采样参数 / 模型名）——「我」池跨联系人采样，任一人输入变了所有人的 me 质心输入都变，
  故任一变化全体重建；全没变则逐人跳过（stdout ✓ 行），不再白付分钟级重嵌。
- 「我」的质心从全部给定联系人的 is_sender=1 wav 池采样（默认各 60 条，上限 300）。
- 依赖 = 转写组（funasr 连带 torch；CAM++ 模型首次运行自动下载）。退出码 0 = 跑完
  （单人样本不足跳过看 stdout △ 行），1 = 硬失败。
"""
import argparse
import hashlib
import json
import os
import random
import sys

import numpy as np

PER_CONTACT_SAMPLE = 60
PER_SPEAKER_CAP = 300
EMBED_MODEL = "iic/speech_campplus_sv_zh-cn_16k-common"


def labeled_wavs(root, contact):
    """chat.json type=34 的 who 标签 × voice/*_<sid>.wav 文件 → {path: who}"""
    chat = json.load(open(os.path.join(root, contact, "chat.json"), encoding="utf-8"))
    by_sid = {}
    for m in chat:
        if m.get("type") == 34 and m.get("sid"):
            by_sid[str(m["sid"])] = m.get("who", "")
    vdir = os.path.join(root, contact, "voice")
    out = []
    for f in os.listdir(vdir):
        if not f.endswith(".wav"):
            continue
        sid = f.rsplit("_", 1)[1][:-4]
        who = by_sid.get(sid)
        if who:
            out.append((os.path.join(vdir, f), who))
    return out


def input_fingerprint(root, contacts):
    """全局输入指纹：「我」池跨联系人采样，任一联系人输入变了所有人的 me 质心输入都变
    ——指纹按全部联系人算，存进每个 npz 的 meta；任一变化全体重建，全没变逐人跳过。"""
    h = hashlib.sha256()
    h.update(f"v1|sample={PER_CONTACT_SAMPLE}|cap={PER_SPEAKER_CAP}|model={EMBED_MODEL}".encode())
    for contact in contacts:
        h.update(f"\n#{contact}\n".encode())
        chat = os.path.join(root, contact, "chat.json")
        try:
            with open(chat, "rb") as f:
                h.update(hashlib.sha256(f.read()).hexdigest().encode())
        except OSError:
            h.update(b"no-chat")
        vdir = os.path.join(root, contact, "voice")
        if os.path.isdir(vdir):
            for f in sorted(os.listdir(vdir)):
                if not f.endswith(".wav"):
                    continue
                try:
                    st = os.stat(os.path.join(vdir, f))
                    h.update(f"|{f}:{st.st_size}:{int(st.st_mtime)}".encode())
                except OSError:
                    pass
    return h.hexdigest()


def existing_meta(path):
    """旧 npz 的 meta（读不动 / 缺失 → None = 必重建）。"""
    try:
        ref = np.load(path, allow_pickle=True)
        if "meta" in ref.files:
            m = json.loads(str(ref["meta"]))
            if isinstance(m, dict):
                return m
    except Exception:
        pass
    return None


def savez_atomic(path, **arrays):
    """npz 原子写：.tmp.npz → os.replace（中断不留半截质心——半截 npz 会被读崩静默降盲聚）。"""
    tmp = path + ".tmp.npz"
    try:
        np.savez(tmp, **arrays)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def load16k(path):
    import librosa

    wav, _ = librosa.load(path, sr=16000, mono=True)
    return wav


def embed_paths(model, paths, tag):
    vecs = []
    for i, p in enumerate(paths):
        try:
            wav = load16k(p)
            if len(wav) < 8000:  # <0.5s 噪声大，跳过
                continue
            r = model.generate(input=p)
            v = r[0]["spk_embedding"].detach().cpu().numpy().reshape(-1)
            vecs.append(v / (np.linalg.norm(v) + 1e-9))
        except Exception as e:
            print(f"  [{tag}] 嵌入失败 {os.path.basename(p)}: {e}")
        if (i + 1) % 40 == 0:
            print(f"  [{tag}] {i + 1}/{len(paths)}")
    return np.array(vecs)


def main():
    ap = argparse.ArgumentParser(description="bz-face refs：构建联系人声纹参考质心")
    ap.add_argument("--data-root", required=True, help="数据根")
    ap.add_argument("--contact", action="append", required=True, help="联系人目录名（可重复）")
    a = ap.parse_args()
    contacts = a.contact
    ROOT = os.path.abspath(a.data_root)
    OUT = os.path.join(ROOT, "voiceprints")
    os.makedirs(OUT, exist_ok=True)
    random.seed(42)

    # 输入索引一次建好（v0.5：原先「我」池 / 对方池 / 校验段把同一人的 chat.json 读三遍）
    pairs_by_contact = {c: labeled_wavs(ROOT, c) for c in contacts}
    fingerprint = input_fingerprint(ROOT, contacts)

    # 增量先判（在加载 CAM++ 之前）：全员命中指纹 → 连模型冷加载都省掉（分钟级白付）
    metas = {c: existing_meta(os.path.join(OUT, f"{c}.npz")) for c in contacts}
    fresh = [c for c in contacts if not (metas[c] and metas[c].get("fingerprint") == fingerprint)]
    for c in contacts:
        if c not in fresh:
            print(f"✓ {c}: 输入未变化，跳过（mode={metas[c].get('mode')}）")

    per_contact_report = []
    for c in contacts:
        pairs = pairs_by_contact[c]
        mine = [p for p, w in pairs if w == "我"]
        peer = [p for p, w in pairs if w == c]
        per_contact_report.append((c, len(mine), len(peer)))
    if not fresh:
        print("各联系人语音样本量：", per_contact_report)
        return

    random.seed(42)

    from funasr import AutoModel

    print("加载 CAM++ …")
    model = AutoModel(model=EMBED_MODEL, disable_update=True, log_level="error")

    mine_paths = []
    for c in contacts:
        pairs = pairs_by_contact[c]
        mine = [p for p, w in pairs if w == "我"]
        peer = [p for p, w in pairs if w == c]
        random.shuffle(mine)
        random.shuffle(peer)
        mine_paths += mine[:PER_CONTACT_SAMPLE]

    random.shuffle(mine_paths)
    mine_paths = mine_paths[:PER_SPEAKER_CAP]
    print(f"「我」参考池：{len(mine_paths)} 条（来自 {len(contacts)} 人）")

    for contact in fresh:
        pairs = pairs_by_contact[contact]
        peer = [p for p, w in pairs if w == contact]
        random.shuffle(peer)
        peer = peer[:PER_SPEAKER_CAP]
        me_vecs = embed_paths(model, mine_paths[:120], f"{contact}/我")
        peer_vecs = embed_paths(model, peer[:120], f"{contact}/对方") if peer else []
        if not len(me_vecs):
            print(f"{contact}: 「我」参考不足，跳过（me={len(me_vecs)} peer={len(peer_vecs)}）")
            continue
        me_c = me_vecs.mean(axis=0)
        me_c /= np.linalg.norm(me_c)
        peer_c = None
        if len(peer_vecs):
            peer_c = peer_vecs.mean(axis=0)
            peer_c /= np.linalg.norm(peer_c)
        hold_mine = [p for p, w in pairs if w == "我"]
        random.shuffle(hold_mine)
        hold_mine = embed_paths(model, hold_mine[:10], f"{contact}/校验我")
        dm = hold_mine @ me_c - (hold_mine @ peer_c if peer_c is not None else 0.0) if len(hold_mine) else np.array([0])
        # me-only（peer 建不出）也落 npz：分离脚本按「非我即对方」降级（issue 509 / ADR-0213）
        meta = {
            "contact": contact,
            "mode": "dual" if peer_c is not None else "me-only",
            "mine_pool": int(len(me_vecs)),
            "peer_pool": int(len(peer_vecs)),
            "holdout_margin_me": float(np.mean(dm)),
            "fingerprint": fingerprint,
        }
        if peer_c is not None:
            hold_peer = embed_paths(model, peer[120:130], f"{contact}/校验对方")
            dp = hold_peer @ peer_c - hold_peer @ me_c if len(hold_peer) else np.array([0])
            meta["holdout_acc"] = float((dm > 0).mean() * 0.5 + (dp > 0).mean() * 0.5)
            meta["holdout_margin_peer"] = float(np.mean(dp))
            savez_atomic(out_path, me=me_c, peer=peer_c, meta=json.dumps(meta, ensure_ascii=False))
            print(f"✓ {contact}: 校验准确率 {meta['holdout_acc']:.1%}（我余量 {meta['holdout_margin_me']:.3f} / 对方余量 {meta['holdout_margin_peer']:.3f}）")
        else:
            savez_atomic(out_path, me=me_c, meta=json.dumps(meta, ensure_ascii=False))
            print(f"△ {contact}: 对方语音样本不足，只建「我」质心（me-only，分离时非我即对方）")

    print("各联系人语音样本量：", per_contact_report)


if __name__ == "__main__":
    main()

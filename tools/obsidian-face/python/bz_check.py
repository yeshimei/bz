# -*- coding: utf-8 -*-
"""
bz-face check —— 导入前「这条录音是不是录错人了」抽检（issue 516 Q15）。

用法（bin/bz-face.js 的 check 子命令转发）:
  python bz_check.py --data-root <数据根> --contact <联系人> --src <录音绝对路径> [--src …] [--ffmpeg <路径>]

- 对**待导入的源文件**（还没复制进 recordings/）均匀抽 3 段（各 3 秒）嵌一次（CAM++），
  与 dual 质心比对：任一段与「我」或「联系人」相似度 ≥ PASS_SIM → ok；三段都不像 → stranger。
- 一个进程查完所有文件（模型只冷加载一次——每条起一个进程会白付分钟级加载）。
- 只在 dual 质心下有判据：me-only 只有一个质心，第三人天然「不像我」，判了必误拦；blind 无身份。
  两种降级下全部文件一律 unknown（**不拦**）。
- 不做「与全库其他联系人质心比对」——要多存全库质心、成本高，解决的场景有限
  （这条能抓「录的是别人」，抓不了「录的是别人的哪一位」）。
- 末行 [bz-result] {"ok":true,"verdicts":{"<src>":"ok|stranger|unknown"}}；退出码 0 = 跑完，
  1 = 硬失败（数据根没有该联系人 / ffmpeg 不可用 / 一个 --src 都没给）。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

EMBED_MODEL = "iic/speech_campplus_sv_zh-cn_16k-common"
CLIP_SEC = 3.0            # 抽检片段时长
CLIPS = 3                 # 抽检段数
# 通过门限：任一抽检段与任一人相似度到这条线就放行。取得比同一人 1s 窗常见相似度低得多，
# 只抓「整条录音都听不出你们俩」这种极端选错——预检宁可不拦（ADR-0216 同款取向）。
PASS_SIM = 0.25


def ffmpeg_wav(src, ffmpeg):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    subprocess.run([ffmpeg or "ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", tmp.name], check=True)
    return tmp.name


def finish(payload, code=0):
    print("[bz-result] " + json.dumps(payload, ensure_ascii=False))
    return code


def load_refs(refs_dir, contact):
    p = os.path.join(refs_dir, f"{contact}.npz")
    if not os.path.exists(p):
        return None, None
    try:
        ref = np.load(p, allow_pickle=True)
    except Exception:
        return None, None
    me = ref["me"] if "me" in ref.files else None
    peer = ref["peer"] if "peer" in ref.files else None
    return me, peer


def main():
    ap = argparse.ArgumentParser(description="bz-face check：导入前录音归属抽检")
    ap.add_argument("--data-root", required=True, help="数据根（voiceprints 的父目录）")
    ap.add_argument("--contact", required=True, help="联系人目录名（质心 npz 键同源）")
    ap.add_argument("--src", action="append", required=True, help="待导入录音的绝对路径（可重复）")
    ap.add_argument("--ffmpeg", default="ffmpeg", help="ffmpeg 命令 / 路径")
    a = ap.parse_args()

    root = os.path.abspath(a.data_root)
    srcs = [s for s in a.src if s.strip()]
    if not srcs:
        print("bz-face check：至少要给一个 --src", file=sys.stderr)
        sys.exit(1)
    if not shutil.which(a.ffmpeg or "ffmpeg"):
        print(f"bz-face check：ffmpeg 不可用：{a.ffmpeg or 'ffmpeg'}", file=sys.stderr)
        sys.exit(1)

    me_c, peer_c = load_refs(os.path.join(root, "voiceprints"), a.contact)
    if me_c is None or peer_c is None:
        # 没质心 / 只有 me：没有判据，全部放行（ADR-0216：降级模式不做归属判定）
        return finish({"ok": True, "verdicts": {s: "unknown" for s in srcs}, "reason": "no-dual-voiceprint"})

    import librosa
    from funasr import AutoModel

    model = None
    verdicts, sims = {}, {}
    for src in srcs:
        if not os.path.exists(src):
            verdicts[src] = "unknown"
            continue
        wav_path = None
        try:
            wav_path = ffmpeg_wav(src, a.ffmpeg)
            wav, _ = librosa.load(wav_path, sr=16000, mono=True)
            n = int(CLIP_SEC * 16000)
            if len(wav) < n:
                verdicts[src] = "unknown"
                continue
            if model is None:
                print("加载 CAM++ …")
                model = AutoModel(model=EMBED_MODEL, disable_update=True, log_level="error")
            span = max(0, len(wav) - n)
            best, pair = 0.0, []
            for i in range(CLIPS):
                s = int(span * (i + 1) / (CLIPS + 1))
                try:
                    v = model.generate(input=wav[s: s + n])[0]["spk_embedding"].detach().cpu().numpy().reshape(-1)
                except Exception:
                    continue
                v = v / (np.linalg.norm(v) + 1e-9)
                a_me, a_peer = float(v @ me_c), float(v @ peer_c)
                pair.append([round(a_me, 3), round(a_peer, 3)])
                best = max(best, a_me, a_peer)
            if not pair:
                verdicts[src] = "unknown"
                continue
            verdicts[src] = "ok" if best >= PASS_SIM else "stranger"
            sims[src] = {"topSim": round(best, 3), "pairs": pair}
            print(f"{os.path.basename(src)}：抽检 {len(pair)} 段，最高 {best:.3f} → {verdicts[src]}")
        except Exception as e:
            print(f"  {os.path.basename(src)} 抽检失败：{e}")
            verdicts[src] = "unknown"
        finally:
            if wav_path:
                try:
                    os.unlink(wav_path)
                except OSError:
                    pass

    return finish({"ok": True, "verdicts": verdicts, "passSim": PASS_SIM, "sims": sims})


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
bz-face prep 本体（issue 468）：单联系人重活——媒体导出 → 派生图片档 → 图片关联表 → 语音转写。

【与数据盘散装脚本的关系】语义收编（逐条去向见 ARCHIVE.md，改动点括注）：
  export_all.py voice 段   → 语音 silk→wav（pysilk 44100Hz 单声道 16bit）。**不回写 chat.json**
                             （464 报告「wav 写回随 468」的说法作废，以票 468 验收为准）：
                             wav 路径只进转写结果表 voice.json（并加 sid 字段，插件按消息 sid 精确对齐）
  export_all.py media 段   → 图片 .dat 解码（4.1 派生密钥 V2 → V1 → 单字节 XOR 三级）、视频
                             （明文直拷 / 加密头试解）、文件直拷、缩略图导出（仅留档，
                             **绝不当 AI 输入**）。解密失败不再拷 pending/——源 .dat 留在
                             attach 原处，计失败数，重跑即重试
  wxgf_decode.py           → wxgf(.bin) 就地转 jpg/gif（截 Annex-B 裸流，ffmpeg -f hevc 解码；
                             多帧 gif / 单帧 jpg；.bin 保留）。收编改动：随图片导出逐条进行
                             （含历史遗留未解码 .bin 的补解码），不再独立二遍扫
  image_ct_map.py          → image_map.json 图片↔消息关联（[{file,ct,sid?}]，ct 升序，同图去重；
                             file 相对联系人目录）。**不回写 chat.json**——chat.json 是只读的
                             一次性产物，关联走旁路表；sid 为新增字段（老格式只有 file/ct）
  voice_transcribe_all.py  → SenseVoice 断点续跑语义原样保留（voice.json 已有 wav 键即跳过；
                             每条转写完立即落盘，崩溃最多丢一条），加 faster-whisper 备选引擎
                             （按 --asr-engine 显式传参，不读任何插件设置文件）
  派生图片档 desc/          → 460 spec：**原图**（非微信自带缩略图）→ 长边 1280 / JPEG 质量 80
                             （--derive-edge / --derive-quality 可配），供插件侧 AI 图片描述上行

【铁的约定】
  · 绝不写回 chat.json（语音仍 `[语音 N秒]`、图片仍 `[图片]`）；绝不接触 vault；绝不 pip install。
  · 幂等可续：媒体 / 派生档「存在即跳过」；转写按 voice.json 已有 wav 键跳过；重复执行只补缺口。
  · 协作式让行：<数据根>/.bz-face/control.json（464 预留的路径）出现 {"action":"pause"} →
    在步骤边界与每条媒体之间让行待命（进程不退出不丢进度——本地语音模型冷加载按分钟计，
    绝不硬杀，控制文件改 resume 或删除即继续）；{"action":"stop"} → 留状态退出
    （[bz-result] 带 stopped:true，退出码 0）。坏 JSON / 未知 action 一律视为无指令，
    长任务绝不因半截写的控制文件而中断。轮询间隔 1s（与 lib/prep-core.js CONTROL_POLL_MS 同源）。
  · 失败口径：单条媒体 / 单条语音 / 单条转写失败计 failed 继续，末尾 [bz-result] 报失败数
    （退出码仍 0——命令本身跑完了，失败数看结果行；重跑即只补失败项）；根本性失败
    （联系人 / chat.json / 解密库 / 媒体目录不存在、转写引擎加载失败）= 硬失败退出码 1。

产物（全落数据根，媒体不入 vault）：
  <数据根>/<联系人>/voice/*.wav        silk → wav
  <数据根>/<联系人>/image/<月>/…       .dat 解密；wxgf 以 .bin 落盘并就地解码出同名 .jpg/.gif
  <数据根>/<联系人>/thumb/<月>/…       微信自带缩略图（仅留档；绝不作 AI 输入、不作派生档源）
  <数据根>/<联系人>/video/<月>/*.mp4   明文直拷或解密
  <数据根>/<联系人>/file/<月>/…        附件直拷
  <数据根>/<联系人>/desc/<月>/*.jpg    派生图片档（长边 / 质量可配）
  <数据根>/<联系人>/image_map.json     图片↔消息关联 [{file,ct,sid?}]（file 相对联系人目录）
  <数据根>/<联系人>/voice.json         转写结果表 [{wav,sid,dur,text,emotion}]（wav 相对数据根）

进度走四行协议（与 src/core/external-tool.ts 同口径；phase 与 lib/prep-core.js PREP_PHASES 同源）：
  [bz-step] <文案>
  [bz-p] {"phase":"media|derive|map|transcribe","pct":0-100|null}
  [bz-info] {"phase":"media|derive|map|transcribe",...}      ← 分段汇总 / 暂停态
  [bz-result] 成功 {ok:true,stopped,contact,media,derive,transcribe,imageMap,failed,failures,…}
              失败 {ok:false,error:"中文原因"}

用法：
  python bz_prep.py --data-root <数据根> --name <联系人> [--src <账号目录>] [--ffmpeg <路径>]
                    [--derive-edge N] [--derive-quality N]
                    [--asr-engine sensevoice|faster-whisper] [--asr-model <名>] [--limit N]
"""
import argparse
import hashlib
import io
import json
import re
import shutil
import sqlite3
import struct
import subprocess
import sys
import time
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor" / "WeChatMsg_Lite"))
sys.path.insert(0, str(HERE))

import bz_sync  # noqa: E402  复用协议输出 / 原子写 / 库读取 / 联系人规划（vendor 路径由其装配）

from bz_sync import atomic_write, fail_hard, info, open_ro, out_line, progress, result, step  # noqa: E402

CONTROL_POLL_SECONDS = 1.0  # 让行待命轮询间隔（lib/prep-core.js CONTROL_POLL_MS 同源）
FAILURES_CAP = 20           # [bz-result].failures 明细上限（failed 计数不受限，全量看各段 fail 计数）

ANNEXB_RE = re.compile(b"\x00\x00\x00\x01|\x00\x00\x01")  # HEVC Annex-B 起始码（wxgf_decode 同款）
SV_TAG_RE = re.compile(r"<\|/?([a-zA-Z]+)\|>")  # SenseVoice 输出清洗（voice_transcribe_all 同款；
# 收编修正：加 /? 使闭合标签 <|/zh|> 一并剥掉——原式只认 [a-zA-Z]+，尾巴会留 <|/zh|>）
SV_EMOTIONS = ("HAPPY", "ANGRY", "SAD", "FEARFUL", "DISGUSTED", "SURPRISED", "NEUTRAL")
MP4_HEADS = (b"ftyp", b"moov", b"mdat", b"free", b"wide")
DERIVE_EXTS = (".jpg", ".jpeg", ".png", ".gif")  # 派生档源 = 解码后的原图（不含 .bin / 缩略图）


class StopRun(Exception):
    """控制文件出现 stop 指令：留状态退出（不硬杀，已落盘产物全保留）。"""


# ---------------- 协作式控制文件 ----------------

def read_action(control_path: Path) -> str:
    """control.json → 'pause'|'stop'|'resume'|''。坏 JSON / 非对象 / 未知 action 一律无指令。"""
    try:
        obj = json.loads(control_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    if not isinstance(obj, dict):
        return ""
    a = obj.get("action")
    return a if a in ("pause", "stop", "resume") else ""


def checkpoint(control_path: Path, phase: str) -> str:
    """安全点（步骤边界 / 每条媒体之间调用）：pause → 让行待命；返回 'stop' 表示该留状态退出。"""
    a = read_action(control_path)
    if a not in ("pause", "stop"):
        return ""
    if a == "stop":
        return "stop"
    info(phase=phase, status="paused",
         note="收到暂停指令：进程待命（控制文件改 resume 或删除即继续，绝不丢进度）")
    while True:
        time.sleep(CONTROL_POLL_SECONDS)
        a = read_action(control_path)
        if a == "stop":
            return "stop"
        if a != "pause":
            info(phase=phase, status="resumed")
            return ""


def ck(control_path: Path, phase: str) -> None:
    """checkpoint 的抛错版：stop 指令 → StopRun（主流程统一接住、留状态退出）。"""
    if checkpoint(control_path, phase) == "stop":
        raise StopRun()


# ---------------- 失败账本（单条失败计失败数继续，末尾结果行报总数） ----------------

class Failures:
    def __init__(self):
        self.count = 0
        self.items = []

    def add(self, kind: str, err) -> None:
        self.count += 1
        if len(self.items) < FAILURES_CAP:
            msg = str(err)[:200] or err.__class__.__name__
            self.items.append({"kind": kind, "error": msg})


# ---------------- .dat 解码（export_all media 段同款收编，密钥派生按账号 wxid 参数化） ----------------

def derive_xor_from_jpg_tail(tail: bytes):
    if len(tail) < 2:
        return None
    k1 = tail[0] ^ 0xFF
    return k1 if tail[1] ^ k1 == 0xD9 else None


_DAT_MOD = None


def _dat_mod():
    """单文件加载 decrypt_dat.py——wxManager 包 __init__ 链上的 protobuf 与 Python 3.14 不兼容
    （export_all 同款）。"""
    global _DAT_MOD
    if _DAT_MOD is None:
        import importlib.util
        p = HERE / "vendor" / "WeChatMsg_Lite" / "wxManager" / "decrypt" / "decrypt_dat.py"
        spec = importlib.util.spec_from_file_location("decrypt_dat_standalone", p)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _DAT_MOD = mod
    return _DAT_MOD


def derive_image_keys(my_wxid: str):
    """4.1 起图片 V2 密钥按账号派生：aes_key = md5(code+wxid).hexdigest()[:16]，
    code 取自 kvcomm 统计文件名 key_<code>_；xor_key = code & 0xFF。
    （export_all._derive_image_keys 同款；收编改动：wxid 显式传入——prep 用数据根
    key.json 的 wxid，绝不读包旁脚本目录的密钥缓存。）"""
    keys = []
    my = re.sub(r"_\d+$", "", my_wxid or "")
    if not my:
        return keys
    kv_roots = [
        Path.home() / "AppData/Roaming/Tencent/xwechat/net/kvcomm",
        Path.home() / "AppData/Roaming/Tencent/WeChat",
    ]
    codes = set()
    for root in kv_roots:
        if not root.exists():
            continue
        for p in root.rglob("key_*.statistic"):
            m = re.match(r"key_(\d+)_", p.name)
            if m:
                codes.add(m.group(1))
    for code in codes:
        aes = hashlib.md5(f"{code}{my}".encode()).hexdigest()[:16].encode()
        keys.append((aes, int(code) & 0xFF))
    return keys


def decode_dat(data: bytes, my_wxid: str):
    """.dat → (扩展名, 明文字节) 或 None（失败）。先试 4.1 派生密钥 V2 新格式，再回退旧逻辑
    （export_all.decode_dat 同款；wxgf 明文头在此分支落为 ext='bin'，交 wxgf 就地转码）。"""
    mod = _dat_mod()
    if not data:
        return None
    if data[:6] in (b"\x07\x08V1\x08\x07", b"\x07\x08V2\x08\x07"):
        from Crypto.Cipher import AES
        aes_size = struct.unpack_from("<I", data, 6)[0]
        enc = data[15:15 + aes_size]
        if len(enc) % 16:
            enc += b"\x00" * (16 - len(enc) % 16)
        for aes_key, xor_key in derive_image_keys(my_wxid):
            head = AES.new(aes_key, AES.MODE_ECB).decrypt(enc)
            if head[:3] == b"\xff\xd8\xff" or head[:4] in (b"\x89PNG", b"GIF8", b"RIFF") or head[:4] == b"wxgf":
                img_type = mod.get_image_type(head[:10])
                seg = data[15 + aes_size + 16: 15 + aes_size + 16 + struct.unpack_from("<I", data, 10)[0]]
                return img_type, head + bytes(b ^ xor_key for b in seg)
    header = data[:0xF]
    if mod.is_v4_image(header):
        enc_len = struct.unpack_from("<H", header, 6)[0]
        enc_len0 = enc_len // 16 * 16 + 16
        enc = data[0xF:0xF + enc_len0]
        if len(enc) % 16:
            enc += b"\x00" * (16 - len(enc) % 16)
        key = mod.AES_KEY_MAP.get(header[:6])
        if key is None:
            return None
        from Crypto.Cipher import AES
        dec = AES.new(key, AES.MODE_ECB).decrypt(enc)
        pad = dec[-1]
        if isinstance(pad, int) and 1 <= pad <= 16:
            dec = dec[:-pad]
        img_type = mod.get_image_type(dec[:10])
        res = data[0xF + enc_len0:]
        xor_key = derive_xor_from_jpg_tail(res[-2:]) if len(res) >= 2 else None
        if img_type == "bin":
            return None
        if xor_key is not None and len(res) > 0x100000:
            res = res[0:-0x100000] + bytes(b ^ xor_key for b in res[-0x100000:])
        return img_type, dec + res
    ft, code = mod.get_code(data[:2])
    if code == -1:
        return None
    ext = {1: "jpg", 3: "png", 5: "gif"}.get(ft, "jpg")
    return ext, bytes(b ^ code for b in data)


def looks_like_mp4(data: bytes) -> bool:
    return len(data) > 8 and data[4:8] in MP4_HEADS


# ---------------- ffmpeg（wxgf 就地转码，wxgf_decode.py 收编；路径参数化） ----------------

def ffmpeg_run(cmd: list) -> int:
    """ffmpeg 静默跑一次，返回退出码；起不动抛 RuntimeError（上层计失败，文案带指引）。"""
    try:
        return subprocess.run(cmd, capture_output=True).returncode
    except OSError as e:
        raise RuntimeError(f"ffmpeg 起不动（用 --ffmpeg 指向 ffmpeg.exe 完整路径）：{e}")


def wxgf_decode_one(bin_path: Path, tmp: Path, ffmpeg: str):
    """wxgf(.bin) → '.jpg'（单帧）/ '.gif'（多帧）/ None。截 Annex-B 裸流 → ffmpeg -f hevc。"""
    data = bin_path.read_bytes()
    m = ANNEXB_RE.search(data)
    if not m:
        return None
    tmp.mkdir(parents=True, exist_ok=True)
    hevc = tmp / "t.265"
    hevc.write_bytes(data[m.start():])
    out_jpg = tmp / "t.jpg"
    out_gif = tmp / "t.gif"
    for f in (out_jpg, out_gif):
        if f.exists():
            f.unlink()
    # 先按单帧试 jpg
    r = ffmpeg_run([ffmpeg, "-y", "-loglevel", "error", "-f", "hevc", "-i", str(hevc),
                    "-frames:v", "1", str(out_jpg)])
    if r == 0 and out_jpg.exists() and out_jpg.stat().st_size > 100:
        return ".jpg"
    # 多帧 → gif（调 fps 兜底）
    r = ffmpeg_run([ffmpeg, "-y", "-loglevel", "error", "-f", "hevc", "-i", str(hevc), str(out_gif)])
    if r == 0 and out_gif.exists() and out_gif.stat().st_size > 100:
        return ".gif"
    return None


# ---------------- 语音导出（export_all voice 段收编；wav 只进转写表，不回写 chat.json） ----------------

def load_media_dbs(db_dir: Path):
    dbs = []
    for p in sorted((db_dir / "message").glob("media_*.db")):
        con = open_ro(p)
        try:
            if con.execute("select 1 from sqlite_master where type='table' and name='VoiceInfo'").fetchone():
                dbs.append(con)
                continue
        except sqlite3.Error:
            pass
        con.close()
    return dbs


def silk_to_wav(silk: bytes, target: Path) -> float:
    from pysilk import decode
    pcm = io.BytesIO()
    decode(io.BytesIO(silk), pcm, 44100)
    frames = pcm.getvalue()
    with wave.open(str(target), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(44100)
        f.writeframes(frames)
    return len(frames) / 2 / 44100


def wav_duration(wav: Path):
    with wave.open(str(wav)) as f:
        return round(f.getnframes() / f.getframerate(), 1)


# ---------------- 派生图片档（460 spec：原图 → 长边/质量可配的 JPEG；缩略图绝不作源） ----------------

def derive_image(src: Path, target: Path, edge: int, quality: int) -> None:
    from PIL import Image, ImageOps
    with Image.open(src) as im:
        im.load()
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")
        w, h = im.size
        longest = max(w, h)
        if 0 < edge < longest:
            ratio = edge / longest
            try:
                resample = Image.Resampling.LANCZOS
            except AttributeError:  # Pillow < 9.1
                resample = Image.LANCZOS
            im = im.resize((max(1, round(w * ratio)), max(1, round(h * ratio))), resample)
        im.save(target, "JPEG", quality=quality)


# ---------------- 语音转写（voice_transcribe_all 收编 + faster-whisper 备选） ----------------

def clean_sensevoice(raw: str):
    """SenseVoice 输出 <|zh|><|NEUTRAL|>文本<|/zh|> → (纯文本, 情感)（voice_transcribe_all 同款）。"""
    emotions = re.findall(r"<\|(" + "|".join(SV_EMOTIONS) + r")\|>", raw)
    text = SV_TAG_RE.sub("", raw).strip()
    return text, (emotions[0] if emotions else "NEUTRAL")


def load_transcribe_engine(engine: str, asr_model: str):
    """按 --asr-engine 显式传参加载本地引擎（绝不回读插件设置文件）。缺依赖 / 加载失败 = 硬失败
    + doctor 指引（模型权重首次运行由引擎自行下载，不是本工具的安装动作）。"""
    step(f"加载转写引擎：{engine}（本地模型冷加载按分钟计，转写一个进程吃完全量）")
    try:
        if engine == "faster-whisper":
            from faster_whisper import WhisperModel
            return WhisperModel(asr_model or "small", device="cpu", compute_type="int8")
        from funasr import AutoModel
        return AutoModel(model="iic/SenseVoiceSmall", disable_update=True, device="cpu")
    except Exception as e:
        fail_hard(
            f"转写引擎（{engine}）加载失败：{e}。缺依赖先跑 bz-face doctor（转写组）；"
            "媒体导出与派生档产物已保留，装好后重跑 bz-face prep 只补转写"
        )


# ---------------- 主流程 ----------------

def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 管道缺省 locale 编码会烂中文
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="bz-face prep：单联系人媒体导出 + 派生图片档 + 关联表 + 语音转写（四行协议）",
        add_help=True,
    )
    ap.add_argument("--data-root", required=True, help="数据根（sync 产物在这里，prep 产物也落这里）")
    ap.add_argument("--name", required=True, help="联系人（sync 导出的目录名）")
    ap.add_argument("--src", help="账号目录（默认取 .bz-face/key.json 的 source_dir）")
    ap.add_argument("--ffmpeg", default="ffmpeg", help="ffmpeg 命令 / 路径（wxgf 解码用；默认 ffmpeg）")
    ap.add_argument("--derive-edge", type=int, default=1280, help="派生图片档长边像素（默认 1280）")
    ap.add_argument("--derive-quality", type=int, default=80, help="派生图片档 JPEG 质量（默认 80）")
    ap.add_argument("--asr-engine", choices=("sensevoice", "faster-whisper"), default="sensevoice",
                    help="语音转写引擎（默认 sensevoice；插件侧按 AI 面板设置下发）")
    ap.add_argument("--asr-model", default="small", help="faster-whisper 档位（默认 small）")
    ap.add_argument("--limit", type=int, default=0, help="调试：限制各段本轮实际处理的条数（0 = 不限）")
    args = ap.parse_args()

    if args.derive_edge < 64:
        fail_hard("--derive-edge 需要 ≥64 的整数（派生档长边像素）")
    if not (1 <= args.derive_quality <= 100):
        fail_hard("--derive-quality 需要 1～100 的整数")
    if args.limit < 0:
        fail_hard("--limit 需要 ≥0 的整数")

    data_root = Path(args.data_root)
    name = args.name
    if not name or Path(name).name != name or name in (".", ".."):
        fail_hard(f"联系人名不合法：{name}（应为 sync 导出的目录名）")
    bz_dir = data_root / ".bz-face"
    control_path = bz_dir / "control.json"

    # ---- 对齐 sync 产物：密钥缓存 → 解密库 → 联系人定位（prep 不取密钥、不需要微信在跑）----
    key_path = bz_dir / "key.json"
    if not key_path.exists():
        fail_hard(f"没有密钥缓存（{key_path}）——先跑 bz-face sync（prep 只吃 sync 的产物）")
    try:
        key = json.loads(key_path.read_text(encoding="utf-8"))
    except Exception as e:
        fail_hard(f"密钥缓存读不出：{e}——先重跑 bz-face sync")
    my_wxid = key.get("wxid") or ""
    src = args.src or key.get("source_dir") or ""

    db_dir = bz_dir / "decrypted" / my_wxid / "db_storage" if my_wxid else None
    if not db_dir or not db_dir.exists():
        cands = sorted(bz_dir.glob("decrypted/*/db_storage"))
        db_dir = cands[0] if len(cands) == 1 else None
    if not db_dir or not db_dir.exists():
        fail_hard("解密库不存在——先跑 bz-face sync（prep 绝不重复解密，也绝不静默换目录）")

    people = bz_sync.load_people(db_dir)
    hit = next((t for t in bz_sync.plan_targets(people) if t["name"] == name), None)
    if hit is None:
        fail_hard(f"联系人「{name}」不在同步产物里——先跑 bz-face sync，联系人按数据根下目录名传")

    cdir = data_root / name
    try:
        flow = json.loads((cdir / "chat.json").read_text(encoding="utf-8"))
    except Exception as e:
        fail_hard(f"chat.json 读不出：{e}——先重跑 bz-face sync（prep 的语音定位与图片关联全靠它对齐）")

    attach = Path(src) / "msg" / "attach" if src else None
    if not attach or not attach.exists():
        fail_hard(f"找不到媒体目录：{attach or '（key.json 里没有账号目录）'}——多账号 / 旧备份用 --src 指定账号目录")

    # 跨段状态（stop 在任何一段发生都要能进结果行，先全部立好）
    fails = Failures()
    stopped = False
    entries = []  # image_map.json 内容
    media = {k: {"done": 0, "skip": 0, "fail": 0} for k in ("voice", "image", "thumb", "video", "file", "wxgf")}
    derive = {"done": 0, "skip": 0, "fail": 0}
    transcribe = {"done": 0, "skip": 0, "fail": 0}

    def ensure_dir(p: Path) -> Path:
        p.mkdir(parents=True, exist_ok=True)
        return p

    def limit_cut(seq):
        return seq[: args.limit] if args.limit and args.limit > 0 else seq

    try:
        # ================= 段 1：媒体导出（media）=================
        step("媒体导出：语音 wav、图片（wxgf 就地转 jpg/gif）、视频、文件、缩略图（仅留档，绝不当 AI 输入）")
        progress("media", 0)
        voices = [m for m in flow if m.get("type") == 34 and m.get("sid")]
        attach_dir = attach / hashlib.md5(hit["wxid"].encode("utf-8")).hexdigest()
        file_jobs = []  # (路径, 类别, 月)——attach 目录名 md5(wxid)（export_all build_hash2name 同款）
        if attach_dir.exists():
            months = sorted(d.name for d in attach_dir.iterdir()
                            if d.is_dir() and len(d.name) == 7 and d.name[4] == "-")
            for month in months:
                for p in sorted((attach_dir / month).rglob("*")):
                    if not p.is_file():
                        continue
                    kind = ("thumb" if "_t" in p.stem
                            else "image" if (p.suffix == ".dat" and "Img" in str(p.parent))
                            else "video" if (p.suffix == ".mp4" or "Video" in str(p.parent))
                            else "file" if "File" in str(p.parent)
                            else "image" if p.suffix == ".dat"
                            else "file")
                    file_jobs.append((p, kind, month))
        voices = limit_cut(voices)
        file_jobs = limit_cut(file_jobs)
        total_items = len(voices) + len(file_jobs)
        done_items = 0

        def tick():
            nonlocal done_items
            done_items += 1
            progress("media", round(done_items * 100 / total_items) if total_items else 100)

        tmp = ensure_dir(bz_dir / ".prep_tmp")

        def try_wxgf(bin_target: Path) -> None:
            """.bin → 同名 .jpg/.gif（.bin 保留）；历史遗留的未解码 .bin 也在这里补上。"""
            stem = bin_target.with_suffix("")
            if stem.with_suffix(".jpg").exists() or stem.with_suffix(".gif").exists():
                return
            try:
                ext = wxgf_decode_one(bin_target, tmp, args.ffmpeg)
            except Exception as e:
                media["wxgf"]["fail"] += 1
                fails.add("wxgf", e)
                return
            if ext:
                (tmp / f"t{ext}").replace(stem.with_suffix(ext))
                media["wxgf"]["done"] += 1
            else:
                media["wxgf"]["fail"] += 1
                fails.add("wxgf", f"wxgf 解码失败：{bin_target.name}")

        def do_image(p: Path, month: str, sub: str):
            """图片 / 缩略图一条 → (status, err)。status: done | skip | fail（wxgf 成败另计）。"""
            data = p.read_bytes()
            r = decode_dat(data, my_wxid)
            if not r:
                return "fail", f".dat 解码失败：{p.parent.name}/{p.name}"
            ext, plain = r
            target = ensure_dir(cdir / sub / month) / f"{p.stem.split('_')[0]}.{ext}"
            if target.exists():
                if ext == "bin":
                    try_wxgf(target)  # 历史遗留：.bin 在、解码产物缺 → 补解码
                return "skip", None
            atomic_write(target, plain)
            if ext == "bin":
                try_wxgf(target)
            return "done", None

        def do_video(p: Path, month: str):
            data = p.read_bytes()
            target = ensure_dir(cdir / "video" / month) / (p.stem + ".mp4")
            if target.exists():
                return "skip", None
            if looks_like_mp4(data):
                atomic_write(target, data)
                return "done", None
            r = decode_dat(data, my_wxid)
            if not r:
                return "fail", f"视频解码失败：{p.parent.name}/{p.name}"
            _, plain = r
            atomic_write(target, plain)
            return "done", None

        def do_file(p: Path, month: str):
            target = ensure_dir(cdir / "file" / month) / p.name
            if target.exists():
                return "skip", None
            shutil.copy2(p, target)
            return "done", None

        # 语音：chat.json type=34 的 sid → VoiceInfo.silk → wav（文件名 <时间戳>_<sid>.wav，
        # sid 进转写表；绝不回写 chat.json）
        silk_ready = True
        silk_err = None
        media_dbs = []
        if voices:
            try:
                import pysilk  # noqa: F401
            except Exception as e:
                silk_ready, silk_err = False, e
            if silk_ready:
                media_dbs = load_media_dbs(db_dir)
            ensure_dir(cdir / "voice")
        for m in voices:
            ck(control_path, "media")
            target = cdir / "voice" / f"{time.strftime('%Y%m%d_%H%M%S', time.localtime(m.get('ct') or 0))}_{m['sid']}.wav"
            if target.exists():
                media["voice"]["skip"] += 1
            elif not silk_ready:
                media["voice"]["fail"] += 1
                fails.add("voice", f"pysilk-mod 未安装（{silk_err}）——先跑 bz-face doctor")
            else:
                silk = None
                for con in media_dbs:
                    try:
                        row = con.execute("select voice_data from VoiceInfo where svr_id=?", (m["sid"],)).fetchone()
                    except sqlite3.Error:
                        row = None
                    if row and row[0]:
                        silk = row[0]
                        break
                if not silk:
                    media["voice"]["fail"] += 1
                    fails.add("voice", f"缺 silk 记录：sid={m['sid']}")
                else:
                    try:
                        silk_to_wav(silk, target)
                        media["voice"]["done"] += 1
                    except Exception as e:
                        media["voice"]["fail"] += 1
                        fails.add("voice", f"sid={m['sid']}: {e}")
            tick()

        for p, kind, month in file_jobs:
            ck(control_path, "media")
            try:
                if kind in ("image", "thumb"):
                    status, err = do_image(p, month, kind)
                elif kind == "video":
                    status, err = do_video(p, month)
                else:
                    status, err = do_file(p, month)
            except Exception as e:  # 单条失败不中断：读源文件炸 / 写盘炸都算这一条的
                status, err = "fail", f"{p.parent.name}/{p.name}: {e}"
            if status == "fail":
                media[kind]["fail"] += 1
                fails.add(kind, err)
            elif status == "done":
                media[kind]["done"] += 1
            else:
                media[kind]["skip"] += 1
            tick()
        for con in media_dbs:
            con.close()
        progress("media", 100)
        info(phase="media", counts=media)

        # ================= 段 2：派生图片档（derive）=================
        step(f"派生图片档：原图 → desc/（长边 {args.derive_edge}、JPEG 质量 {args.derive_quality}）；缩略图绝不作源")
        progress("derive", 0)
        img_root = cdir / "image"
        sources = sorted(q for q in img_root.rglob("*")
                         if q.is_file() and q.suffix.lower() in DERIVE_EXTS) if img_root.exists() else []
        sources = limit_cut(sources)
        for i, q in enumerate(sources):
            ck(control_path, "derive")
            progress("derive", round(i * 100 / len(sources)) if sources else 100)
            target = ensure_dir(cdir / "desc" / q.parent.name) / (q.stem + ".jpg")
            if target.exists():
                derive["skip"] += 1
                continue
            try:
                derive_image(q, target, args.derive_edge, args.derive_quality)
                derive["done"] += 1
            except Exception as e:
                derive["fail"] += 1
                fails.add("derive", f"{q.parent.name}/{q.name}: {e}")
        progress("derive", 100)
        info(phase="derive", **derive)

        # ================= 段 3：图片关联表（map，旁路表——不写回 chat.json）=================
        step("图片关联表：image_map.json（图片↔消息，ct 升序；chat.json 只读不动）")
        progress("map", None)
        disk = {}  # hex → "<月>/<文件名>"（image_ct_map 同款：只收解码产物，.bin 不算可消费）
        img_root = cdir / "image"
        if img_root.exists():
            for q in img_root.rglob("*"):
                if q.is_file() and q.suffix != ".bin":
                    disk.setdefault(q.stem, f"{q.parent.name}/{q.name}")
        seen = set()
        refs = 0
        for m in flow:
            if m.get("type") != 3:
                continue
            refs += 1
            hexs = (m.get("img") or "").split("/")[-1]
            rel = disk.get(hexs)
            if not rel or rel in seen:
                continue  # 无磁盘文件 / 同图被多条消息引用只记一次
            entry = {"file": rel, "ct": int(m.get("ct") or 0)}
            if m.get("sid"):
                entry["sid"] = int(m["sid"])
            entries.append(entry)
            seen.add(rel)
        entries.sort(key=lambda e: e["ct"])
        atomic_write(cdir / "image_map.json",
                     json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        progress("map", 100)
        info(phase="map", refs=refs, mapped=len(entries), file="image_map.json")

        # ================= 段 4：语音转写（transcribe）=================
        step(f"语音转写：{args.asr_engine} → voice.json（已完成音频幂等跳过，每条转完立即落盘）")
        progress("transcribe", 0)
        vjson = cdir / "voice.json"
        recs = []
        if vjson.exists():
            try:
                loaded = json.loads(vjson.read_text(encoding="utf-8"))
                if isinstance(loaded, list):
                    recs = [r for r in loaded if isinstance(r, dict)]
            except Exception:
                recs = []  # 坏表按空表续：重转写并整表重写（幂等覆盖）
        done_keys = {r.get("wav") for r in recs}
        voice_root = cdir / "voice"
        wavs = sorted(voice_root.glob("*.wav")) if voice_root.exists() else []
        jobs = [w for w in limit_cut(wavs) if f"{name}/voice/{w.name}" not in done_keys]
        transcribe["skip"] = len(wavs) - len(jobs)
        if jobs:
            ck(control_path, "transcribe")  # stop 已在手就别起引擎——模型冷加载按分钟计，不白付
            engine = load_transcribe_engine(args.asr_engine, args.asr_model)
            for wav in jobs:
                ck(control_path, "transcribe")
                try:
                    dur = wav_duration(wav)
                except Exception:
                    dur = None
                sid_str = wav.stem.rsplit("_", 1)[-1] if "_" in wav.stem else ""
                sid = int(sid_str) if sid_str.isdigit() else 0
                if args.asr_engine == "faster-whisper":
                    try:
                        segments, _ = engine.transcribe(str(wav))
                        text = "".join(s.text for s in segments).strip()
                        emotion = ""  # whisper 无情感输出：宁可空着也不假报
                    except Exception as e:
                        text, emotion = f"<转写失败:{e}>", "ERR"
                else:
                    try:
                        res = engine.generate(input=str(wav))
                        raw = res[0]["text"] if res else ""
                        text, emotion = clean_sensevoice(raw)
                    except Exception as e:
                        text, emotion = f"<转写失败:{e}>", "ERR"
                if emotion == "ERR":
                    transcribe["fail"] += 1
                    fails.add("transcribe", f"{wav.name}: {text}")
                else:
                    transcribe["done"] += 1
                recs.append({"wav": f"{name}/voice/{wav.name}", "sid": sid, "dur": dur,
                             "text": text, "emotion": emotion})
                atomic_write(vjson, json.dumps(recs, ensure_ascii=False).encode("utf-8"))
                progress("transcribe",
                         round((transcribe["done"] + transcribe["fail"] + transcribe["skip"]) * 100 / len(wavs))
                         if wavs else 100)
        progress("transcribe", 100)
        info(phase="transcribe", engine=args.asr_engine, file="voice.json", **transcribe)
    except StopRun:
        stopped = True
        step("收到停止指令：留状态退出——已完成的媒体 / 派生档 / 转写全保留，重跑只补缺口")

    payload = {
        "ok": True,
        "stopped": stopped,
        "contact": name,
        "dataRoot": str(data_root),
        "media": media,
        "derive": derive,
        "transcribe": transcribe,
        "failed": fails.count,
        "failures": fails.items,
    }
    if not stopped:
        payload["imageMap"] = len(entries)
    result(payload)
    tail = (f"预处理{'中止' if stopped else '完成'}：图片 {media['image']['done'] + media['image']['skip']}"
            f"（wxgf 转 {media['wxgf']['done']}）、语音 {media['voice']['done'] + media['voice']['skip']}"
            f"、转写 {transcribe['done']}、派生档 {derive['done'] + derive['skip']}、关联 {len(entries)} 条；"
            f"失败 {fails.count}")
    if stopped:
        tail += "（stopped——重跑 bz-face prep 只补缺口）"
    elif fails.count:
        tail += "（失败名单见 [bz-result].failures，重跑即只补失败项）"
    out_line(tail)
    return 0


if __name__ == "__main__":
    sys.exit(main())

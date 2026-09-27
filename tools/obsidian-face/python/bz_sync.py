#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
bz-face sync 本体（issue 464；485 改轻）：取密钥 → 解密数据库 → 逐联系人统计 → 头像源落位。

【与数据盘散装脚本的关系】语义收编自 export_all.py 的 text 段（ct/type/who/msg/sid/dur
消息流）、image_ct_map.py（packed_info_data 32hex = 本地文件名 md5 → 图片定位）、
emoticon_writeback.py（表情命名）——三者并入 export 轮的 chat.json 生成（460 spec / 票 464）。
媒体导出（.dat 解码 / wav 导出 / wxgf 解码）与语音转写**不在本脚本**：chat.json 只含
「从微信解出来的事实」——语音保持 `[语音 N秒]`（时长入 dur）、图片保持 `[图片]`
（定位入 img）、表情当场命名 `[表情·名]`（命不中保持 `[表情]`）。

【两轮口径（issue 485）】全量同步的大头是逐人重读全量消息并序列化 chat.json——
而同步本身只需要统计数字。拍板拆两轮：

  sync 轮（不带 --contact，给插件的「同步」按钮）：
    取密钥 → 解密（增量秒过）→ 逐联系人 **SQL 聚合统计**（消息数 / 语音数 / 图片数 /
    语音时长 / 最新消息时间 / 最大 sid / 是否群聊，无人读消息正文）写
    `<联系人>/stats.json`，头像源照旧落位。**不再产出 chat.json**——全量消息挪到
    export 轮按需导出。实测 5 分 21 秒（57 人 / 7.2 万条）的大头就此打掉，日常同步
    进入十秒级。
  export 轮（--contact <目录名> 可多值，给插件的「导入所选」）：
    不取密钥（只用缓存 key.json，不要求微信在跑）→ 解密（增量秒过）→ 对指定联系人
    走既有 export_flow 全量导出 chat.json + 头像。单人两万条量级秒级完成。

产物（全部落数据根，不再落脚本旁）：
  <数据根>/<联系人>/stats.json    sync 轮统计 {msgs,voices,images,voiceSec,lastCt,maxSid,group,syncedAt}
  <数据根>/<联系人>/chat.json     export 轮消息流 [{ct,type,who,msg,sid,dur?,img?}]，type 为 4.x 原始码
  <数据根>/<联系人>/avatar.<ext>  头像源（微信头像库 head_image 原样字节；无头像不落文件）
  <数据根>/.bz-face/key.json      密钥缓存（sync 轮每轮从微信进程新取；export 轮只读缓存）
  <数据根>/.bz-face/decrypted/    解密库（增量：已解密的库由上游缓存自动跳过）

img 字段格式与插件侧既有约定一致（src/people/datasource.ts RawChatMsg.img）：`<月>/<文件名>`。
月取消息本地时间；文件名是 packed_info_data 里的 32hex（解码前不知道扩展名，468 媒体导出
解码后按同 hex 补全）。

幂等：stats.json / chat.json / 头像按字节比对，内容没变不写（不破坏已正确的产物）；解密走
上游缓存。微信未运行 / 取密钥失败 / 解密失败 = 硬失败：立即退出码 1 + 中文原因，绝不静默
降级读旧目录；单联系人导出失败计入 failed 继续，末尾 [bz-result] 报失败数（此时退出码仍
0——命令本身跑完了，失败数看结果行）。

进度走四行协议（与 src/core/external-tool.ts 同口径）：
  [bz-step] <文案>
  [bz-p] {"phase":"key|decrypt|contacts","pct":0-100|null}   ← 头像随 contacts 逐人进行，不单开阶段
  [bz-info] {"phase":"contacts","total":N}                   ← contacts 段开始时报总人数（484 进度换算）
  [bz-info] {"phase":"contact",...}                          ← 逐人结果明细
  [bz-result] 成功 {ok:true,mode,contacts,written,unchanged,failed,skipped,msgTotal,named,failures:[…]}
              失败 {ok:false,error:"中文原因"}

用法（sync 轮需微信登录运行状态下；export 轮不需要微信）：
  python bz_sync.py --data-root <数据根> [--src <账号目录>] [--min-messages N] [--limit N]
  python bz_sync.py --data-root <数据根> [--src <账号目录>] --contact <目录名> [--contact <目录名> …]
"""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor" / "WeChatMsg_Lite"))
sys.path.insert(0, str(HERE))

import bz_export  # noqa: E402  复用取密钥 / 解密 / 文本化（vendor 路径由其装配）

TYPE_MASK = bz_export.TYPE_MASK
# packed_info_data 里的文件名 md5（image_ct_map 语义：取首个 32hex）
HEX32_RE = re.compile(rb"[0-9a-f]{32}")
# 表情 XML 的 md5 属性（emoticon_writeback 同款：负向后顾排除 externmd5= 等子串误配）
EMD5_RE = re.compile(r'(?<![A-Za-z0-9_])md5="([0-9a-f]{32})"')
# caption 内部换行清洗（emoticon_writeback 同款）
LINEBREAK_RE = re.compile(r"[\r\n\u2028\u2029\u0085]+")

WECHAT_PROCESS = "Weixin.exe"
STDERR_TAIL = 2048  # stderr 留尾字数（与 src/core/external-tool.ts 同口径）


# ---------------- 协议输出 ----------------

def out_line(text: str) -> None:
    sys.stdout.write(text + "\n")
    sys.stdout.flush()


def step(text: str) -> None:
    out_line(f"[bz-step] {text}")


def progress(phase: str, pct) -> None:
    out_line("[bz-p] " + json.dumps({"phase": phase, "pct": pct}, ensure_ascii=False))


def info(**kw) -> None:
    out_line("[bz-info] " + json.dumps(kw, ensure_ascii=False))


def result(payload: dict) -> None:
    out_line("[bz-result] " + json.dumps(payload, ensure_ascii=False))


def fail_hard(error: str) -> None:
    """硬失败：结果行 + stderr + 退出码 1。绝不静默降级。"""
    result({"ok": False, "error": error})
    print(error, file=sys.stderr)
    sys.exit(1)


def clean_caption(text) -> str:
    """caption 清洗：去首尾空白与内部换行（emoticon_writeback 同款）。空/None 返回 ''。"""
    if not text:
        return ""
    return LINEBREAK_RE.sub("", str(text).strip()).strip()


def atomic_write(path: Path, data: bytes) -> None:
    """原子写：.tmp + os.replace（emoticon_writeback 同款，防半截文件）。"""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def open_ro(p: Path):
    return sqlite3.connect(f"file:{p}?mode=ro", uri=True)


# ---------------- 预检与取密钥 ----------------

def ensure_wechat_running() -> None:
    """微信 4.x 进程不在 → 立即硬失败。绝不静默降级成读旧目录（票 464 验收）。"""
    try:
        import psutil
    except ImportError:
        return  # 无 psutil 不做进程预检，让取密钥自身的报错兜底（doctor 负责报缺依赖）
    for p in psutil.process_iter(["name"]):
        try:
            if (p.info.get("name") or "").lower() == WECHAT_PROCESS.lower():
                return
        except Exception:
            continue
    fail_hard(
        f"未检测到微信进程（{WECHAT_PROCESS}）——请先打开并登录微信（登录后停在主界面），"
        "再重跑 bz-face sync"
    )


def take_key(key_path: Path) -> dict:
    """从微信进程取密钥并落 key_path（优先每轮新取；现取失败且有缓存 → 回退已缓存密钥）。

    回退依据：密钥是账号级的，旧密钥能解同账号新版本数据库（官方封堵 ≥4.0.3.36 内存取密钥
    后，数据盘时代缓存过的 key 依旧可用——ADR-0195「缓存密钥解密链不依赖 yara/取密钥」口径）。
    """
    step(f"取密钥：从微信进程内存提取（{WECHAT_PROCESS} 需已登录）")
    progress("key", None)
    try:
        old = bz_export.keyinfo(key_path)
    except Exception:
        old = None  # 还没有缓存 / 缓存损坏都不算错——本轮就是要新取
    try:
        info_ = bz_export.extract_key()
    except (SystemExit, Exception) as e:  # noqa: B014——上游把版本封堵做成 SystemExit，与普通异常同路
        # 现取失败：有可用缓存就回退（绝不静默——step 说明改用缓存）；无缓存才硬失败
        cached = None
        try:
            if key_path.exists():
                cached = json.loads(key_path.read_text(encoding="utf-8"))
        except Exception:
            cached = None
        if cached and cached.get("key"):
            wxid = str(cached.get("wxid") or "未知账号")
            step(f"微信内存取密钥不可用（{str(e)[:80]}）——改用已缓存密钥（{wxid}，密钥账号级可解新版库）")
            return {
                "wxid": wxid,
                "source_dir": str(cached.get("source_dir") or ""),
                "old_wxid": wxid,
                "cached": True,
            }
        fail_hard(
            f"取密钥失败：{e}。请确认微信已登录并停留在主界面；"
            "环境缺依赖先跑 bz-face doctor 自检；"
            f"微信为封堵版本时可将已知可用的 key.json 放到 {key_path} 再同步（缓存密钥可解同账号新版库）"
        )
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_text(
        json.dumps(
            {"key": info_.key, "source_dir": info_.wx_dir, "wxid": info_.wxid},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"wxid": info_.wxid, "source_dir": info_.wx_dir, "old_wxid": (old or {}).get("wxid", "")}


# ---------------- 解密 ----------------

def decrypt_all(key_path: Path, data_root: Path, src_override=None) -> Path:
    step("解密数据库（增量：已解密的库自动跳过）")
    progress("decrypt", None)
    out_root = data_root / ".bz-face" / "decrypted"
    key_info = json.loads(key_path.read_text(encoding="utf-8"))
    src = src_override or key_info.get("source_dir")
    if src and not Path(src).exists():
        fail_hard(f"微信数据目录不存在：{src}（多账号 / 旧备份可用 --src 指定账号目录）")
    # 498：--src 填的是微信根目录（多账号父目录，如 …\xwechat_files）时落回 key.json 的
    # 账号目录——解密缓存按账号目录精确匹配，父目录会让缓存每轮失效、整库重解（分钟级）
    key_src = key_info.get("source_dir")
    if (
        src and key_src and Path(key_src).exists()
        and Path(src).resolve() != Path(key_src).resolve()
        and not (Path(src) / "db_storage").is_dir()
    ):
        step(f"--src 是微信根目录，解密按 key.json 落到账号目录：{key_src}")
        src = key_src
    try:
        db_dir = bz_export.decrypt_db(src, str(out_root), key_path=str(key_path))
    except SystemExit as e:
        fail_hard(f"数据库解密失败：{e}")
    except Exception as e:
        fail_hard(f"数据库解密失败：{e}")
    return Path(db_dir)


# ---------------- 联系人与表定位 ----------------

def safe_name(nm: str) -> str:
    for ch in '\\/:*?"<>|':
        nm = nm.replace(ch, "_")
    return nm.strip() or "_"


def load_people(db_dir: Path) -> dict:
    """contact.db → {wxid: {name, remark, nick}}（export_all.load_contacts 同款）。"""
    people = {}
    con = open_ro(db_dir / "contact" / "contact.db")
    con.row_factory = sqlite3.Row
    for r in con.execute("select username, remark, nick_name from contact"):
        u = r["username"] or ""
        if u:
            people[u] = {
                "name": (r["remark"] or "").strip() or (r["nick_name"] or "").strip() or u,
                "remark": (r["remark"] or "").strip(),
                "nick": (r["nick_name"] or "").strip(),
            }
    con.close()
    return people


def plan_targets(people: dict) -> list:
    """非群联系人 → 导出目标 [{wxid, name}]；显示名 safe_name 后**重名全部加 wxid 后缀**
    （与顺序无关的去重——目录名必须确定，不然换台机器重跑就写进别的目录）。"""
    raw = {}
    for wxid, p in people.items():
        if wxid.endswith("@chatroom"):
            continue  # 群聊跳过：脸谱针对个人
        raw[wxid] = safe_name(p.get("name") or wxid)
    by_name = {}
    for wxid, nm in raw.items():
        by_name.setdefault(nm, []).append(wxid)
    targets = []
    for wxid, nm in raw.items():
        if len(by_name[nm]) > 1:
            nm = f"{nm} ({wxid})"
        targets.append({"wxid": wxid, "name": nm})
    targets.sort(key=lambda t: t["name"])
    return targets


def locate_tables(db_dir: Path, wxids: list) -> dict:
    """{wxid: [(message_*.db, Msg_<md5>)]}——一次扫全部消息库，按 md5(wxid) 反查归属。"""
    md52wxid = {hashlib.md5(u.encode("utf-8")).hexdigest(): u for u in wxids}
    tables = {}
    msg_dir = db_dir / "message"
    for p in sorted(msg_dir.glob("message_*.db")):
        try:
            con = open_ro(p)
            for (t,) in con.execute("select name from sqlite_master where type='table' and name like 'Msg_%'").fetchall():
                wxid = md52wxid.get(t[len("Msg_"):])
                if wxid:
                    tables.setdefault(wxid, []).append((p, t))
            con.close()
        except sqlite3.Error:
            continue
    return tables


def load_emoticon_captions(db_dir: Path) -> dict:
    """emoticon.db → {md5: caption}（商店名优先，收藏名兜底；emoticon_writeback 同款）。
    库缺失 / 单表缺失按表容错：缺哪张跳过哪张，已取到的名字不丢。"""
    p = db_dir / "emoticon" / "emoticon.db"
    if not p.exists():
        return {}
    store = {}
    try:
        con = open_ro(p)
    except sqlite3.Error:
        return {}
    try:
        for md5_, cap in con.execute("select md5_, caption_ from kStoreEmoticonCaptionsTable"):
            cap = clean_caption(cap)
            if cap:
                store[md5_] = cap
    except sqlite3.Error:
        pass  # 商店名表缺失 → 收藏名仍可兜底
    try:
        for md5_, cap in con.execute("select md5, caption from kNonStoreEmoticonTable"):
            cap = clean_caption(cap)
            if cap and md5_ not in store:
                store[md5_] = cap
    except sqlite3.Error:
        pass  # 收藏表缺失 → 只用商店名
    con.close()
    return store


# ---------------- 头像 ----------------

def avatar_buffer(db_dir: Path, wxid: str) -> bytes:
    """微信头像库原样字节（vendor HeadImageDB.get_avatar_buffer 同款 SQL，直读免起整套管理器）。"""
    p = db_dir / "head_image" / "head_image.db"
    if not p.exists():
        return b""
    try:
        con = open_ro(p)
        row = con.execute("select image_buffer from head_image where username=?", (wxid,)).fetchone()
        con.close()
        return row[0] if row and row[0] else b""
    except sqlite3.Error:
        return b""


def avatar_ext(buf: bytes) -> str:
    if buf[:4] == b"\x89PNG":
        return "png"
    if buf[:3] == b"\xff\xd8\xff":
        return "jpg"
    if buf[:4] == b"GIF8":
        return "gif"
    return "png"  # 上游 set_avatar_buffer 一律存 PNG，兜底 png


# ---------------- 单联系人导出（export 轮本体） ----------------

def export_flow(db_dir: Path, tables: list, name_of, my_wxid: str, captions: dict, talker_name: str):
    """一位联系人的消息流。返回 (flow, named, imgs)。
    消息流字段与 export_all.cmd_text 同款（ct/type/who/msg/sid/dur），并当场并入：
      · 表情命名（emoticon_writeback 语义）：47 命中商店/收藏名 → `[表情·名]`；
      · 图片定位（image_ct_map 语义）：3 命中 32hex → img = `<月>/<hex>`。"""
    flow = []
    named = imgs = 0
    sid2em, sid2img, ct2img = {}, {}, {}
    for dbp, table in tables:
        con = open_ro(dbp)
        try:
            # sid 列名两套并存（export_all.cmd_text 同款探测）：msg_svrid 优先，server_id 兜底
            cols = {d[1] for d in con.execute(f'pragma table_info("{table}")')}
            sidcol = "msg_svrid" if "msg_svrid" in cols else ("server_id" if "server_id" in cols else "")

            # 1) 表情：sid → md5（47 消息 zstd XML；解不开的跳过）。无 sid 列 = 命名无键可挂，跳过
            if sidcol:
                try:
                    for sid, content in con.execute(
                        f'select {sidcol}, message_content from "{table}" where (local_type & 0xFFFFFFFF)=47'
                    ):
                        if not sid or content is None or int(sid) in sid2em:
                            continue
                        try:
                            raw = bz_export._cell_text(content)
                        except Exception:
                            continue
                        m = EMD5_RE.search(raw)
                        if m:
                            sid2em[int(sid)] = m.group(1)
                except sqlite3.Error:
                    pass

            # 2) 图片：sid / ct → 文件名 md5 hex（无 sid 列退回纯 ct，image_ct_map 同款兜底）
            try:
                if sidcol:
                    rows = con.execute(
                        f'select {sidcol}, create_time, packed_info_data from "{table}" '
                        f"where (local_type & 0xFFFFFFFF)=3"
                    ).fetchall()
                else:
                    rows = [
                        (None, ct, packed)
                        for ct, packed in con.execute(
                            f'select create_time, packed_info_data from "{table}" where (local_type & 0xFFFFFFFF)=3'
                        )
                    ]
            except sqlite3.OperationalError:
                rows = [
                    (None, ct, packed)
                    for ct, packed in con.execute(
                        f'select create_time, packed_info_data from "{table}" where (local_type & 0xFFFFFFFF)=3'
                    )
                ]
            for sid, ct, packed in rows:
                if not isinstance(packed, bytes):
                    continue
                m = HEX32_RE.search(packed)
                if not m:
                    continue
                hexs = m.group(0).decode()
                if sid:
                    sid2img[int(sid)] = hexs
                ct2img.setdefault(int(ct or 0), hexs)

            # 3) 主消息流（export_all.cmd_text 同款 SQL / 字段 / 过滤）
            has_sender = "real_sender_id" in cols
            flagcol = "m.WCDB_CT_message_content" if "WCDB_CT_message_content" in cols else "0"
            sexpr = "n.user_name" if has_sender else "''"
            iexpr = f"m.{sidcol}" if sidcol else "0"
            sql = (
                f'select m.create_time, m.local_type, {sexpr} as sender, m.message_content, {iexpr} as sid, '
                f'{flagcol} as flag from "{table}" m left join Name2Id n on m.real_sender_id = n.rowid '
                f"order by m.sort_seq"
            )
            for ct, lt, sender, content, sid, flag in con.execute(sql):
                base = int(lt or 0) & TYPE_MASK
                text = "" if base in (3, 47) else bz_export._cell_text(content)
                if flag and isinstance(content, bytes) and not text and base not in (3, 47):
                    continue  # zstd 解压失败
                label = bz_export.describe_message(base, text)
                if not label:
                    continue
                rec = {
                    "ct": int(ct or 0),
                    "type": base,
                    "who": "我" if sender == my_wxid else (name_of(sender) if sender else talker_name),
                    "msg": label,
                    "sid": int(sid or 0),
                }
                if base == 34:
                    ms = bz_export._attr(text, "voicelength")
                    rec["dur"] = round(int(ms) / 1000, 1) if ms.isdigit() and int(ms) > 0 else None
                elif base == 47 and sid:
                    cap = captions.get(sid2em.get(int(sid)), "")
                    if cap:
                        rec["msg"] = f"[表情·{cap}]"
                        named += 1
                elif base == 3:
                    hexs = (sid2img.get(int(sid)) if sid else None) or ct2img.get(int(ct or 0))
                    if hexs:
                        rec["img"] = f"{time.strftime('%Y-%m', time.localtime(rec['ct']))}/{hexs}"
                        imgs += 1
                flow.append(rec)
        finally:
            con.close()
    return flow, named, imgs


# ---------------- 统计聚合（sync 轮本体，485） ----------------

# describe_message 会给出非空 label 的消息类型白名单（统计口径近似 export_flow 的
# flow 命中面；10000 系统消息需有内容——空系统消息不出 label。zstd 解压失败的条目
# 两侧都进不来，误差只剩罕见的空 10000，可接受）。
STATS_TYPE_WHITELIST_SQL = "(1,3,34,43,47,49,50,42,48)"


def contact_stats(db_dir: Path, tables: list, my_wxid: str) -> dict:
    """一位联系人的统计聚合（sync 轮；无人读消息正文）。
    消息 / 语音 / 图片 / 最新消息时间 / 最大 sid 全走 SQL 聚合；群聊 = 去掉我之后
    还有多个不同发送者（与插件侧 datasource.isGroupChat 的 who 口径同语义）；语音
    时长的 voicelength 在 zstd 压缩的 XML 里，SQL 聚合不了——只解语音条（千条级，
    比全量消息便宜两个数量级）。返回 {msgs,voices,images,voiceSec,lastCt,maxSid,group}。"""
    msgs = voices = images = 0
    last_ct = 0
    max_sid = 0
    senders = set()
    voice_sec = 0.0
    for dbp, table in tables:
        con = open_ro(dbp)
        try:
            cols = {d[1] for d in con.execute(f'pragma table_info("{table}")')}
            sidcol = "msg_svrid" if "msg_svrid" in cols else ("server_id" if "server_id" in cols else "")
            has_sender = "real_sender_id" in cols
            # Name2Id 缺失（异常库 / 拆分库变体）：sender 不可得，join 一并省掉——
            # 统计照出（群聊按单聊处理），不让整人 failed（export_flow 同款左连接的容错缺口在这补上）
            has_name2id = con.execute(
                "select 1 from sqlite_master where type='table' and name='Name2Id'"
            ).fetchone() is not None
            join = " left join Name2Id n on m.real_sender_id = n.rowid" if has_name2id else ""
            sexpr = "n.user_name" if (has_sender and has_name2id) else "''"
            iexpr = f"m.{sidcol}" if sidcol else "0"
            where = (
                f"((m.local_type & 0xFFFFFFFF) in {STATS_TYPE_WHITELIST_SQL})"
                " or ((m.local_type & 0xFFFFFFFF)=10000 and m.message_content is not null)"
            )
            row = con.execute(
                f'select count(*), sum((m.local_type & 0xFFFFFFFF)=34),'
                f' sum((m.local_type & 0xFFFFFFFF)=3), max(m.create_time), max({iexpr})'
                f' from "{table}" m{join}'
                f" where {where}"
            ).fetchone()
            msgs += int(row[0] or 0)
            voices += int(row[1] or 0)
            images += int(row[2] or 0)
            last_ct = max(last_ct, int(row[3] or 0))
            max_sid = max(max_sid, int(row[4] or 0))
            if sexpr != "''":
                for (s,) in con.execute(
                    f'select distinct {sexpr} from "{table}" m{join}'
                    f" where {sexpr} != '' and {sexpr} != ?",
                    (my_wxid,),
                ):
                    senders.add(s)
            # 语音时长：只取 type=34 的内容解 zstd 抽 voicelength
            for (content,) in con.execute(
                f'select message_content from "{table}" where (local_type & 0xFFFFFFFF)=34'
            ):
                ms = bz_export._attr(bz_export._cell_text(content), "voicelength")
                if ms.isdigit() and int(ms) > 0:
                    voice_sec += int(ms) / 1000
        finally:
            con.close()
    return {
        "msgs": msgs,
        "voices": voices,
        "images": images,
        "voiceSec": round(voice_sec, 1),
        "lastCt": last_ct,
        "maxSid": max_sid,
        "group": len(senders) > 1,
    }


def write_stats_json(cdir: Path, st: dict) -> str:
    """stats.json 原子写 + 字节比对幂等。返回 new / updated / unchanged（同 chat.json 口径）。"""
    payload = json.dumps(st, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    target = cdir / "stats.json"
    old = target.read_bytes() if target.exists() else None
    if old == payload:
        return "unchanged"
    atomic_write(target, payload)
    return "new" if old is None else "updated"


def write_avatar(cdir: Path, db_dir: Path, wxid: str) -> str:
    """头像源落位（两轮共用；微信头像库原样字节 + 字节比对幂等）。返回状态词。"""
    buf = avatar_buffer(db_dir, wxid)
    if not buf:
        return "none"
    apath = cdir / f"avatar.{avatar_ext(buf)}"
    old_av = apath.read_bytes() if apath.exists() else None
    if old_av == buf:
        return "unchanged"
    atomic_write(apath, buf)
    return "new" if old_av is None else "updated"


# ---------------- 主流程 ----------------

def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 管道缺省 locale 编码会烂中文
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(description="bz-face sync：微信 → 统计与按需导出（四行协议）", add_help=True)
    ap.add_argument("--data-root", help="数据根（必填：密钥 / 解密库 / 联系人目录都落这里）")
    ap.add_argument("--src", help="账号目录（默认当前微信数据目录）")
    ap.add_argument("--min-messages", type=int, default=1, help="少于该条数的联系人不落盘（默认 1 = 全量）")
    ap.add_argument("--limit", type=int, default=0, help="调试：限制处理联系人数（0 = 不限）")
    ap.add_argument(
        "--contact",
        action="append",
        default=[],
        help="export 轮：指定联系人目录名（可多值）——全量导出这些人的 chat.json + 头像；缺省 = sync 轮全量统计",
    )
    args = ap.parse_args()

    if not args.data_root:
        fail_hard("缺少 --data-root <数据根>——同步产物（密钥 / 解密库 / 联系人目录）都落在这里")
    if args.min_messages < 1:
        fail_hard("--min-messages 需要 ≥1 的整数")
    if args.contact and args.limit:
        fail_hard("export 轮按 --contact 精确指定，不需要 --limit")
    data_root = Path(args.data_root)
    bz_dir = data_root / ".bz-face"
    key_path = bz_dir / "key.json"
    try:
        bz_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        fail_hard(f"数据根不可写：{e}")

    if args.contact:
        return export_round(args, data_root, key_path)
    return sync_round(args, data_root, key_path)


def sync_round(args, data_root: Path, key_path: Path) -> int:
    """sync 轮（485 变轻）：取密钥 → 解密（增量）→ 逐联系人 SQL 聚合统计写 stats.json → 头像源。
    不再产出 chat.json——全量消息由 export 轮按需导出。"""
    # 1. 预检 + 取密钥（微信未运行在 ensure_wechat_running / extract_key 里硬失败）
    ensure_wechat_running()
    ki = take_key(key_path)
    info(phase="key", wxid=ki["wxid"], keyCached=str(key_path))
    my_wxid = ki["wxid"]

    # 2. 解密（增量）
    db_dir = decrypt_all(key_path, data_root, args.src)

    # 3. 逐联系人统计（SQL 聚合，无人读消息正文）+ 头像源
    step("统计联系人：逐人聚合消息 / 语音 / 图片 / 语音时长 / 最新消息（chat.json 改为按需导出）")
    people = load_people(db_dir)
    targets = plan_targets(people)
    tables = locate_tables(db_dir, [t["wxid"] for t in targets])
    if args.limit and args.limit > 0:
        targets = targets[: args.limit]
    info(phase="contacts", total=len(targets))

    written = unchanged = failed = skipped = 0
    msg_total = 0
    failures = []
    total = len(targets)
    for i, t in enumerate(targets):
        progress("contacts", round(i * 100 / total) if total else 100)
        try:
            tbls = tables.get(t["wxid"]) or []
            if not tbls:
                skipped += 1
                info(phase="contact", name=t["name"], status="skipped", reason="没有消息记录")
                continue
            st = contact_stats(db_dir, tbls, my_wxid)
            if st["msgs"] < args.min_messages:
                skipped += 1
                info(phase="contact", name=t["name"], status="skipped", reason=f"消息 {st['msgs']} 条少于下限 {args.min_messages}")
                continue
            cdir = data_root / t["name"]
            cdir.mkdir(parents=True, exist_ok=True)

            # stats.json：字节比对幂等——没变不写（不破坏已正确的产物）
            stats_status = write_stats_json(cdir, {**st, "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%S")})
            if stats_status != "unchanged":
                written += 1
            else:
                unchanged += 1
            msg_total += st["msgs"]

            # 头像源照旧随统计逐人落位（一条 SQL + 字节写，不在 485 打掉的大头里）
            avatar_status = write_avatar(cdir, db_dir, t["wxid"])

            info(
                phase="contact", name=t["name"], status="ok", msgs=st["msgs"],
                imgs=st["images"], voices=st["voices"], voiceSec=st["voiceSec"],
                chat=stats_status, avatar=avatar_status,
            )
        except Exception as e:  # 单联系人失败不中断整体
            failed += 1
            msg = str(e)[:200] or e.__class__.__name__
            failures.append({"name": t["name"], "error": msg})
            info(phase="contact", name=t["name"], status="failed", error=msg)
    progress("contacts", 100)

    exported = written + unchanged
    result({
        "ok": True,
        "mode": "stats",
        "contacts": exported,
        "written": written,
        "unchanged": unchanged,
        "failed": failed,
        "skipped": skipped,
        "msgTotal": msg_total,
        "named": 0,  # 表情命名要读正文，归 export 轮口径；sync 轮恒 0
        "failures": failures,
        "dataRoot": str(data_root),
    })
    tail = f"同步完成：联系人 {exported}，写入 {written}，未变 {unchanged}，跳过 {skipped}，失败 {failed}；消息 {msg_total} 条（统计口径，chat.json 按需导出）"
    if failed:
        tail += "（失败名单见 [bz-result].failures，重跑即只补失败项）"
    print(tail)
    return 0


def export_round(args, data_root: Path, key_path: Path) -> int:
    """export 轮（485 新增）：--contact 指定的联系人走既有 export_flow 全量导出 chat.json + 头像。
    不取密钥（只用缓存 key.json）、不预检微信进程——导入/画谱发生时微信未必在跑；
    解密照跑（增量缓存全命中时秒过）。--min-messages 对 export 轮不生效（点名导出即全量）。"""
    if not key_path.exists():
        fail_hard("还没有缓存的解密密钥（数据根 .bz-face/key.json）——先跑一次 bz-face sync，再按需导出")
    db_dir = decrypt_all(key_path, data_root, args.src)

    wanted = list(dict.fromkeys(args.contact))  # 去重保序
    step(f"导出聊天与头像：{len(wanted)} 位联系人生成 chat.json（文本 / [表情·名] / 图片定位 / 语音时长）")

    people = load_people(db_dir)
    by_name = {t["name"]: t for t in plan_targets(people)}
    tables = locate_tables(db_dir, [by_name[nm]["wxid"] for nm in wanted if nm in by_name])
    captions = load_emoticon_captions(db_dir)
    try:
        my_wxid = str(json.loads(key_path.read_text(encoding="utf-8")).get("wxid") or "")
    except Exception:
        my_wxid = ""  # wxid 读不出只影响「我」的归属判定兜底，不挡导出
    info(phase="contacts", total=len(wanted))

    name_map = {t["wxid"]: t["name"] for t in by_name.values()}

    def name_of(wxid):
        if wxid is None:
            return "_"
        return name_map.get(wxid) or (people.get(wxid, {}).get("name") or wxid)

    written = unchanged = failed = skipped = 0
    msg_total = named_total = 0
    failures = []
    total = len(wanted)
    for i, nm in enumerate(wanted):
        progress("contacts", round(i * 100 / total) if total else 100)
        t = by_name.get(nm)
        try:
            if t is None:
                # 目录名在微信联系人里反查不到（手改 / 已删 / 重名目录被动过）：单人失败不中断整体
                raise RuntimeError("数据根里没有这个联系人目录对应的微信联系人（重跑 sync 可重建映射）")
            tbls = tables.get(t["wxid"]) or []
            if not tbls:
                skipped += 1
                info(phase="contact", name=nm, status="skipped", reason="没有消息记录")
                continue
            flow, named, imgs = export_flow(db_dir, tbls, name_of, my_wxid, captions, t["name"])
            cdir = data_root / nm
            cdir.mkdir(parents=True, exist_ok=True)

            # chat.json：字节比对幂等——没变不写（不破坏已正确的产物）
            payload = json.dumps(flow, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            target = cdir / "chat.json"
            old = target.read_bytes() if target.exists() else None
            chat_status = "new" if old is None else ("unchanged" if old == payload else "updated")
            if chat_status != "unchanged":
                atomic_write(target, payload)
                written += 1
            else:
                unchanged += 1
            msg_total += len(flow)
            named_total += named

            avatar_status = write_avatar(cdir, db_dir, t["wxid"])
            info(
                phase="contact", name=nm, status="ok", msgs=len(flow),
                named=named, imgs=imgs, chat=chat_status, avatar=avatar_status,
            )
        except Exception as e:  # 单联系人失败不中断整体
            failed += 1
            msg = str(e)[:200] or e.__class__.__name__
            failures.append({"name": nm, "error": msg})
            info(phase="contact", name=nm, status="failed", error=msg)
    progress("contacts", 100)

    exported = written + unchanged
    result({
        "ok": True,
        "mode": "export",
        "contacts": exported,
        "written": written,
        "unchanged": unchanged,
        "failed": failed,
        "skipped": skipped,
        "msgTotal": msg_total,
        "named": named_total,
        "failures": failures,
        "dataRoot": str(data_root),
    })
    tail = f"导出完成：联系人 {exported}，写入 {written}，未变 {unchanged}，跳过 {skipped}，失败 {failed}；消息 {msg_total} 条"
    if failed:
        tail += "（失败名单见 [bz-result].failures，重跑即只补失败项）"
    print(tail)
    return 0


if __name__ == "__main__":
    sys.exit(main())

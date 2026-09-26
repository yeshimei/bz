#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
包仔脸谱域 · 微信聊天记录导出助手（微信 4.x → CSV）

流程：从微信进程拿密钥 → 解密数据库 → 列出联系人 → 按选择导出 CSV。
依赖 vendor/WeChatMsg_Lite（留痕 4.x 适配版，已做安全审查：无网络外发）。

用法（在微信登录运行的状态下）：
  python bz_export.py info                          # 提取并缓存密钥
  python bz_export.py decrypt [--src X] [--out Y]   # 解密指定数据源
  python bz_export.py contacts [--src X]            # 解密 + 列联系人（写 contacts.json）
  python bz_export.py export <wxid> [--start 起] [--end 止] [--src X]

--src 是**账号目录**（形如 ...\\xwechat_files\\wxid_xxx_abcd），默认取当前微信数据目录。
密钥是账号级的：同一账号的旧版本数据（如 4.1 备份）可用同一把密钥解开。

【收编说明 · issue 463】原散装于数据盘 tools/（bz_export.py 与 WeChatMsg_Lite 同层），
本票收编进 @jwbz/obsidian-face 包：唯一改动是上游库路径 → vendor/WeChatMsg_Lite
（裁剪版：去 .git / 3.x 遗留模块 / ffmpeg.exe / emoji 等大资源，详见包内 ARCHIVE.md）。

【464 接线】keyinfo / cmd_info / decrypt_db 增加 key_path 显式路径参数（缺省仍是脚本旁
KEY_FILE，老用法零变化），bz_sync.py 据此把密钥 / 解密库落到数据根（--data-root）。
本脚本不再被 sync 直接人肉串跑；解密 / 导出语义由 bz_sync.py 收编复用。
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOL = HERE / "vendor" / "WeChatMsg_Lite"
sys.path.insert(0, str(TOOL))

EXPORT_DIR = HERE / "export"    # CSV 输出目录
KEY_FILE = HERE / "key.json"
CONTACTS_FILE = HERE / "contacts.json"


def extract_key():
    """从微信 4.x 进程内存提取密钥（微信需已登录运行）

    用 wx_info_v4.dump_wechat_info_v4 而非 wxinfo.dump_wechat_info_v4_：后者硬编码
    读 biz/biz.db，新登录账号还没这个库会直接 FileNotFoundError；前者用
    favorite_fts.db / head_image.db，两者随账号创建即存在。
    """
    import multiprocessing

    import pymem
    from wxManager.decrypt.wx_info_v4 import dump_wechat_info_v4

    multiprocessing.freeze_support()
    pm = pymem.Pymem("Weixin.exe")
    info = dump_wechat_info_v4(pm.process_id)
    if not info or not info.key:
        errcode = getattr(info, "errcode", None)
        hint = "微信 4.0.3.36 及以上已封堵内存取密钥，需退回 4.0.3.19；" if errcode == 405 else ""
        raise SystemExit(f"未能提取密钥（errcode={errcode}）。{hint}请确认微信已登录并停留在主界面。")
    return info


def cmd_info(key_path=None):
    info = extract_key()
    target = Path(key_path) if key_path else KEY_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps({"key": info.key, "source_dir": info.wx_dir, "wxid": info.wxid}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({
        "wxid": info.wxid,
        "nickname": info.nick_name,
        "version": info.version,
        "wx_dir": info.wx_dir,
        "key_cached": str(target),
    }, ensure_ascii=False, indent=2))


def keyinfo(key_path=None):
    p = Path(key_path) if key_path else KEY_FILE
    if not p.exists():
        raise SystemExit(f"还没有密钥缓存（{p}），先跑：python bz_export.py info")
    return json.loads(p.read_text(encoding="utf-8"))


def default_out_root(src: str) -> Path:
    """按数据源推断解密输出目录，避免不同版本的数据互相覆盖"""
    name = Path(src).name
    suffix = "_41原始数据备份" in str(src) or "41" in Path(src).parent.name
    return HERE / ("decrypted41" if suffix else "decrypted")


def decrypt_db(src: str | None = None, out_root: Path | None = None, key_path=None) -> str:
    """用缓存密钥解密微信数据库，返回解密后 db_storage 目录"""
    from wxManager.decrypt_runner import decrypt_wechat_database

    ki = keyinfo(key_path)
    src = src or ki["source_dir"]
    out_root = out_root or default_out_root(src)
    if not Path(src).exists():
        raise SystemExit(f"数据源不存在：{src}")
    res = decrypt_wechat_database(
        db_version=4,
        source_dir=src,
        output_root=str(out_root),
        use_cache_db=True,
        use_cache_key=True,
        force_decrypt=False,
        key_input_func=lambda *_: ki["key"],  # 用缓存密钥，不交互
    )
    if not res.get("ok"):
        raise SystemExit(f"数据库解密失败：{res.get('message')}")
    db_dir = res.get("db_dir")
    print(f"数据源：{src}")
    print(f"数据库已解密：{db_dir}")
    return str(db_dir)


def _open_db(db_dir):
    from wxManager import DatabaseConnection
    db = DatabaseConnection(db_dir, 4).get_interface()
    if db is None:
        raise SystemExit("数据库初始化失败（解密目录是否有效？）")
    return db


def cmd_contacts(src=None, out_root=None):
    db = _open_db(decrypt_db(src, out_root))
    rows = []
    for c in db.get_contacts():
        wxid = str(getattr(c, "wxid", "") or "")
        if not wxid or wxid.endswith("@chatroom"):
            continue  # 群聊跳过：脸谱针对个人
        rows.append({
            "wxid": wxid,
            "nickname": str(getattr(c, "nickname", "") or ""),
            "remark": str(getattr(c, "remark", "") or ""),
            "alias": str(getattr(c, "alias", "") or ""),
        })
    rows.sort(key=lambda r: (r["remark"] or r["nickname"] or r["wxid"]))
    CONTACTS_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"共 {len(rows)} 位联系人，已写入 {CONTACTS_FILE}")


def cmd_export(wxid, src=None, out_root=None, start="2015-01-01 00:00:00", end="2030-12-31 23:59:59"):
    db = _open_db(decrypt_db(src, out_root))
    from exporter.config import FileType
    from exporter.exporter_csv import CSVExporter
    contact = None
    for c in db.get_contacts():
        if str(getattr(c, "wxid", "") or "") == wxid:
            contact = c
            break
    if contact is None:
        raise SystemExit(f"没找到联系人：{wxid}")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    exporter = CSVExporter(
        db,
        contact,
        output_dir=str(EXPORT_DIR),
        type_=FileType.CSV,
        message_types=None,
        time_range=[start, end],
        group_members=None,
    )
    exporter.start()
    print("导出完成：", getattr(exporter, "csv_path", EXPORT_DIR))


# ---------------- 直接导出插件可读 JSON ----------------
#
# 不用 CSVExporter 的原因：它的 CSV 表头是中文（消息ID/类型/wxid/时间/内容/…），
# 且「wxid」列填的是联系人自己的 wxid、**没有发送人列**——脸谱要区分「我说的」
# 和「对方说的」，这份 CSV 丢了该信息。所以这里直接读解密库产出 JSON：
#   { "<显示名>": [ {createtime, msg, is_sender, type}, ... ], ... }
# 字段名对齐插件 src/people/parse.ts 的 JSON keyed 形态与字段别名表。

TEXT_TYPE = 1  # local_type=1 为纯文本
TYPE_MASK = 0xFFFFFFFF  # 4.x 的 local_type 高位带子类型标志，低 32 位才是真类型


def _zstd(data: bytes) -> str:
    """解微信 4.x 的 zstd 压缩内容（WCDB_CT_message_content 非 0 时启用）"""
    import io

    import zstandard
    dctx = zstandard.ZstdDecompressor()
    try:
        raw = dctx.decompress(data)
    except zstandard.ZstdError:
        raw = dctx.stream_reader(io.BytesIO(data)).read()
    return raw.decode("utf-8", errors="replace")


def _cell_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bytes):
        try:
            return _zstd(v)
        except Exception:
            return ""
    return str(v)


def _tag(xml: str, name: str) -> str:
    m = re.search(rf"<{name}>(.*?)</{name}>", xml, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def _attr(xml: str, name: str) -> str:
    m = re.search(rf'{name}\s*=\s*"([^"]*)"', xml)
    return m.group(1).strip() if m else ""


def _describe_appmsg(xml: str) -> str:
    """appmsg（type 49）按子类型文本化：引用 / 文件 / 拍一拍 / 分享 / 小程序…"""
    m = re.search(r"<appmsg[^>]*>.*?<type>(\d+)</type>", xml, re.S)
    st = m.group(1) if m else ""
    title = _tag(xml, "title")
    des = _tag(xml, "des")
    if st == "57":  # 引用：refermsg 是被引用的原文，title 是本次说的话
        ref = re.search(r"<refermsg>.*?</refermsg>", xml, re.S)
        quoted = _tag(ref.group(0), "content")[:120] if ref else ""
        if quoted and title:
            return f"[引用「{quoted}」] {title}"
        return f"[引用「{quoted}」]" if quoted else (title or "[引用]")
    if st == "6":
        return f"[文件] {title}" if title else "[文件]"
    if st == "62":
        return title or "[拍一拍]"
    if st == "8":  # appattach + emoticonmd5：表情包
        return "[表情]"
    if st == "19":
        return f"[聊天记录] {title}" if title else "[聊天记录]"
    if st == "51":
        return "[分享]"
    if st in ("4", "5"):
        return f"[分享] {title}" + (f" - {des}" if des else "")
    if st in ("33", "36", "44"):
        return f"[小程序] {title}" if title else "[小程序]"
    return f"[分享] {title}" if title else (f"[非文本消息 {st}]" if st else "[非文本消息]")


def describe_message(base_type: int, text: str) -> str:
    """把任意类型消息文本化；返回空串表示该条不纳入脸谱"""
    if base_type == 1:
        return text.strip()
    if base_type == 3:
        return "[图片]"
    if base_type == 34:
        ms = _attr(text, "voicelength")
        return f"[语音 {round(int(ms) / 1000)}秒]" if ms.isdigit() and int(ms) > 0 else "[语音]"
    if base_type == 43:
        sec = _attr(text, "playlength")
        return f"[视频 {sec}秒]" if sec.isdigit() else "[视频]"
    if base_type == 47:
        return "[表情]"
    if base_type == 50:
        m = re.search(r"<!\[CDATA\[(.*?)\]\]>", text, re.S)
        if not m:
            return "[通话]"
        label = re.sub(r"\s+", " ", m.group(1)).strip()
        return f"[{label}]"
    if base_type == 42:
        nm = _attr(text, "nickname")
        return f"[名片] {nm}" if nm else "[名片]"
    if base_type == 48:
        lb = _attr(text, "label")
        return f"[位置] {lb}" if lb else "[位置]"
    if base_type == 49:
        return _describe_appmsg(text)
    if base_type == 10000:
        t = text.strip()
        return t if t and "撤回" not in t else ("[撤回了一条消息]" if "撤回" in t else "")
    return ""


def fold_repeats(msgs: list) -> list:
    """折叠连续同款无参数标签（连发 5 个表情 → [表情×5]），带参数的（语音时长）不折叠"""
    out: list = []
    for m in msgs:
        t = m["msg"]
        foldable = t.startswith("[") and t.endswith("]")
        if (
            foldable
            and out
            and out[-1].get("_raw") == t
            and out[-1]["is_sender"] == m["is_sender"]
        ):
            out[-1]["_n"] += 1
            out[-1]["msg"] = f"{t[:-1]}×{out[-1]['_n']}]"
            continue
        out.append({**m, "_raw": t, "_n": 1})
    for m in out:
        m.pop("_raw", None)
        m.pop("_n", None)
    return out


def _probe_schema(msg_dir: Path):
    """探测库结构：{db_path: {表名: {列名集合}}}，并汇总候选 username 用于 md5 反查"""
    import sqlite3

    schema = {}
    known = set()
    for p in sorted(msg_dir.glob("message_*.db")):
        con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        info = {}
        for (t,) in con.execute("select name from sqlite_master where type='table' and name like 'Msg_%'").fetchall():
            info[t] = {d[1] for d in con.execute(f'pragma table_info("{t}")')}
        schema[p] = info
        if con.execute("select 1 from sqlite_master where type='table' and name='Name2Id'").fetchone():
            for (u,) in con.execute("select user_name from Name2Id"):
                if u:
                    known.add(u)
        con.close()
    return schema, known


def cmd_dump(src=None, out_root=None, out_file=None, min_messages=20, include_group=False):
    import hashlib
    import sqlite3 as sq

    db_dir = Path(decrypt_db(src, out_root))
    msg_dir = db_dir / "message"
    my_wxid = keyinfo().get("wxid", "")

    # 1. 联系人显示名
    con = sq.connect(f"file:{db_dir / 'contact' / 'contact.db'}?mode=ro", uri=True)
    con.row_factory = sq.Row
    people = {}
    for r in con.execute("select username, remark, nick_name, local_type from contact"):
        u = r["username"] or ""
        if not u:
            continue
        people[u] = {
            "remark": (r["remark"] or "").strip(),
            "nick": (r["nick_name"] or "").strip(),
            "type": r["local_type"],
        }
    con.close()

    schema, known = _probe_schema(msg_dir)
    known |= set(people)
    known.add(my_wxid)
    hash2name = {f"Msg_{hashlib.md5(u.encode('utf-8')).hexdigest()}": u for u in known}

    # 2. 逐库逐表读文本消息
    buckets: dict[str, list] = {}
    skipped_tables = []
    for db_path, tables in schema.items():
        con = sq.connect(f"file:{db_path}?mode=ro", uri=True)
        for table, cols in tables.items():
            talker = hash2name.get(table)
            if talker is None:
                skipped_tables.append(table)
                continue
            if (not include_group) and talker.endswith("@chatroom"):
                continue
            # 发送人：4.x 用 real_sender_id 关联 Name2Id.rowid（不是 sender_username 列）
            has_sender = "real_sender_id" in cols
            expr = "n.user_name" if has_sender else "''"
            flagcol = "m.WCDB_CT_message_content" if "WCDB_CT_message_content" in cols else "0"
            sql = (
                f'select m.create_time, m.local_type, {expr} as sender, m.message_content, {flagcol} as flag '
                f'from "{table}" m left join Name2Id n on m.real_sender_id = n.rowid '
                f"order by m.sort_seq"
            )
            bucket = buckets.setdefault(talker, [])
            try:
                for ct, lt, sender, content, flag in con.execute(sql):
                    base = int(lt or 0) & TYPE_MASK
                    # 图片/表情不需要内容细节，省一次 zstd 解压
                    text = "" if base in (3, 47) else _cell_text(content)
                    if flag and isinstance(content, bytes) and not text and base not in (3, 47):
                        continue  # 解压失败
                    label = describe_message(base, text)
                    if not label:
                        continue
                    bucket.append({
                        "createtime": int(ct or 0),
                        "msg": label,
                        "is_sender": 1 if sender == my_wxid else 0,
                        "type": TEXT_TYPE,  # 已文本化，插件侧按文本消息消费
                    })
            except sq.Error as e:
                skipped_tables.append(f"{table}({e})")
        con.close()

    for u in list(buckets):
        buckets[u] = fold_repeats(buckets[u])

    # 3. 组装显示名（重名加 wxid 后缀区分）
    def display(u: str) -> str:
        info = people.get(u, {})
        nm = info.get("remark") or info.get("nick") or u
        return nm

    named = {}
    used = {}
    for u, msgs in buckets.items():
        if len(msgs) < min_messages:
            continue
        nm = display(u)
        if nm in used and used[nm] != u:
            nm = f"{nm} ({u})"
        used[nm] = u
        named[nm] = msgs

    ordered = dict(sorted(named.items(), key=lambda kv: -len(kv[1])))
    payload = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    target = Path(out_file) if out_file else (HERE / "脸谱导入.json")
    target.write_text(payload, encoding="utf-8")

    total = sum(len(v) for v in ordered.values())
    print(f"会话 {len(ordered)} 位（消息数 ≥ {min_messages}），文本消息 {total} 条")
    print(f"输出：{target}  ({len(payload.encode('utf-8')) / 1048576:.1f} MB)")
    print("--- 消息量 Top 15 ---")
    for i, (nm, msgs) in enumerate(list(ordered.items())[:15]):
        print(f"{len(msgs):>7}  {nm}")
    if skipped_tables:
        print(f"（{len(skipped_tables)} 张表无法归属/读取，已跳过）")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="包仔脸谱域 · 微信聊天记录导出助手", add_help=True)
    sub = ap.add_subparsers(dest="cmd")

    sub.add_parser("info", help="从微信进程提取密钥并缓存")

    for name, helptext in (("decrypt", "解密数据库"), ("contacts", "解密 + 列联系人")):
        sp = sub.add_parser(name, help=helptext)
        sp.add_argument("--src", help="账号目录（默认当前微信数据目录）")
        sp.add_argument("--out", help="解密输出根目录")

    sp = sub.add_parser("dump", help="直接导出插件可读 JSON（推荐）")
    sp.add_argument("--src", help="账号目录（默认当前微信数据目录）")
    sp.add_argument("--out", help="解密输出根目录")
    sp.add_argument("--file", help="JSON 输出路径")
    sp.add_argument("--min-messages", type=int, default=20, help="少于该条数的联系人不导出")
    sp.add_argument("--include-group", action="store_true", help="同时导出群聊")

    sp = sub.add_parser("export", help="导出某位联系人的 CSV")
    sp.add_argument("wxid")
    sp.add_argument("--src", help="账号目录（默认当前微信数据目录）")
    sp.add_argument("--out", help="解密输出根目录")
    sp.add_argument("--start", default="2015-01-01 00:00:00")
    sp.add_argument("--end", default="2030-12-31 23:59:59")

    args = ap.parse_args()
    out = Path(args.out) if getattr(args, "out", None) else None
    if args.cmd == "contacts":
        cmd_contacts(args.src, out)
    elif args.cmd == "decrypt":
        decrypt_db(args.src, out)
    elif args.cmd == "dump":
        cmd_dump(args.src, out, args.file, args.min_messages, args.include_group)
    elif args.cmd == "export":
        cmd_export(args.wxid, args.src, out, args.start, args.end)
    else:
        cmd_info()

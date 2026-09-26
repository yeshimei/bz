from __future__ import annotations

import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from wxManager import Me
from wxManager.decrypt import decrypt_v4, get_info_v4
from wxManager.decrypt.decrypt_dat import get_decode_code_v4


KeyInputFunc = Callable[[str], str]

_EXIT_COMMANDS = {"q", "quit", "exit", "cancel", "退出", "取消"}
_HEX_KEY_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")


def ensure_cached_decrypt_key(
    db_version: int = 4,
    source_dir: str | None = None,
    output_root: str = ".",
    key_input_func: KeyInputFunc | None = None,
) -> dict[str, Any]:
    """
    启动阶段检查微信数据库 key。

    处理逻辑：
    1. 已存在可用缓存 key -> 直接返回
    2. 没有缓存 key -> 立即要求用户输入
    3. 检查 key 格式
    4. 使用微信原始数据库验证 key
    5. 验证成功后写入 decrypt_cache.json

    注意：
   这里只验证并缓存 key，不执行完整数据库解密。
    """
    try:
        if db_version != 4:
            return _fail(f"不支持的 db_version：{db_version}")

        output_root_path = Path(output_root).expanduser().resolve()
        output_root_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        cache_path = _get_cache_path(output_root_path)
        cache = _load_cache(output_root_path)

        # -------------------------
        # 1. 已存在可用缓存 key
        # -------------------------
        cached_key_info = _get_cached_key_info(
            cache=cache,
            db_version=db_version,
            source_dir=source_dir,
        )

        if cached_key_info:
            return {
                "ok": True,
                "message": "已找到缓存微信数据库 key",
                "key_source": "cache",
                "cache_path": str(cache_path),
            }

        # -------------------------
        # 2. 没有 key，立即要求输入
        # -------------------------
        provider = key_input_func or input

        last_error = ""

        while True:
            prompt = (
                "未检测到微信数据库 Key。\n"
                "请输入 64 位十六进制数据库 Key。"
            )

            if last_error:
                prompt += (
                    f"\n\n{last_error}\n"
                    "请重新输入正确的 Key。"
                )

            try:
                raw_value = provider(prompt)
            except (EOFError, KeyboardInterrupt):
                return _fail("用户取消输入数据库 key")
            except Exception as exc:
                return _fail(
                    f"读取用户输入失败：{exc}"
                )

            raw_value = str(
                raw_value or ""
            ).strip()

            if not raw_value:
                last_error = "Key 不能为空。"
                continue

            command = _normalize_command(raw_value)

            if command in _EXIT_COMMANDS:
                return _fail(
                    "用户取消输入数据库 key"
                )

            key = _normalize_key(raw_value)

            # -------------------------
            # 3. 格式校验
            # -------------------------
            if not _is_valid_key(key):
                last_error = (
                    "Key 格式不正确，应为 "
                    "64 个十六进制字符。"
                )
                continue

            # -------------------------
            # 4. 获取当前微信账户信息
            # -------------------------
            account_info = _resolve_v4_account_info(
                source_dir=source_dir,
                output_root=output_root_path,
            )

            if account_info is None:
                return _fail(
                    "无法确定微信原始数据库目录。"
                    "请确认微信已经登录。"
                )

            wx_dir = _normalize_source_root(
                account_info["source_dir"]
            )

            db_storage_dir = (
                wx_dir / "db_storage"
            )

            if not db_storage_dir.is_dir():
                return _fail(
                    "没有找到微信数据库目录："
                    f"{db_storage_dir}"
                )

            validation_db = _find_validation_db(
                db_storage_dir
            )

            if validation_db is None:
                return _fail(
                    "没有找到可用于验证 Key 的"
                    "微信数据库文件。"
                )

            # -------------------------
            # 5. 验证 key
            # -------------------------
            try:
                key_matches = (
                    decrypt_v4.validate_key_v4(
                        key,
                        str(validation_db),
                    )
                )
            except Exception as exc:
                last_error = (
                    f"验证数据库 Key 时出错：{exc}"
                )
                continue

            if not key_matches:
                last_error = (
                    "输入的 Key 与当前微信数据库"
                    "不匹配。"
                )
                continue

            # -------------------------
            # 6. 验证成功，缓存 key
            # -------------------------
            _update_cache(
                output_root_path,
                db_version=db_version,
                wxid=account_info["wxid"],
                source_dir=_norm_path(
                    account_info["source_dir"]
                ),
                key=key,
            )

            return {
                "ok": True,
                "message": (
                    "微信数据库 Key 验证成功，"
                    "已写入缓存"
                ),
                "key_source": "manual",
                "cache_path": str(cache_path),
            }

    except Exception as exc:
        return _fail(
            f"检查微信数据库 Key 失败：{exc}"
        )


def decrypt_wechat_database(
    db_version: int = 4,
    source_dir: str | None = None,
    output_root: str = ".",
    use_cache_db: bool = True,
    use_cache_key: bool = True,
    force_decrypt: bool = False,
    key_input_func: KeyInputFunc | None = None,
) -> dict[str, Any]:
    """
    解析并解密微信数据库。

    处理顺序：

    1. 可选：直接使用已经解密好的数据库缓存。
    2. 可选：使用缓存中的数据库 Key。
    3. 如果没有有效缓存 Key，则要求用户手动输入。
    4. 手动 Key 验证成功后写入缓存并进行解密。

    本函数不会自动从微信进程中获取数据库 Key。
    """

    try:
        output_root_path = Path(output_root).expanduser().resolve()
        output_root_path.mkdir(parents=True, exist_ok=True)
        cache_path = _get_cache_path(output_root_path)
        cache = _load_cache(output_root_path)

        # 第一层缓存：直接使用已经解密好的 db_dir。
        if use_cache_db and not force_decrypt:
            cached_db_dir = _get_cached_db_dir(
                cache=cache,
                db_version=db_version,
                source_dir=source_dir,
            )
            if cached_db_dir:
                return _success(
                    message="使用缓存 db_dir，跳过 key 检测和重复解密",
                    db_dir=Path(cached_db_dir),
                    wxid=cache.get("wxid"),
                    source_dir=cache.get("source_dir"),
                    from_cache_db=True,
                    from_cache_key=False,
                    key_source="cache_db",
                    cache_path=str(cache_path),
                )

        # 第二层缓存：用缓存 key 解密最新数据库。
        if use_cache_key:
            cached_key_info = _get_cached_key_info(
                cache=cache,
                db_version=db_version,
                source_dir=source_dir,
            )
            if cached_key_info:
                if db_version != 4:
                    return _fail(f"不支持的 db_version：{db_version}")

                result = _dump_v4_with_key(
                    key=cached_key_info["key"],
                    wxid=cached_key_info["wxid"],
                    wx_dir=cached_key_info["source_dir"],
                    output_root=output_root_path,
                )
                if result.get("ok"):
                    return _finalize_success(
                        result=result,
                        output_root=output_root_path,
                        db_version=db_version,
                        key=cached_key_info["key"],
                        key_source="cache",
                        from_cache_key=True,
                    )

                print(
                    "[decrypt cache] 缓存 key 与当前数据库不匹配，"
                    "将清除缓存 key 并尝试自动识别。"
                )
                _remove_cached_key(output_root_path)

        return _manual_key_retry_loop(
            source_dir=source_dir,
            output_root=output_root_path,
            db_version=db_version,
            initial_error=(
                "没有找到可用的缓存数据库 Key"
            ),
            key_input_func=key_input_func,
        )

    except FileNotFoundError as e:
        return _fail(f"文件不存在：{e}")
    except PermissionError as e:
        return _fail(f"没有权限访问文件：{e}")
    except Exception as e:
        return _fail(f"数据库解析失败：{e}")


# =========================
# manual key input
# =========================


def _manual_key_retry_loop(
    source_dir: str | None,
    output_root: Path,
    db_version: int,
    initial_error: str,
    key_input_func: KeyInputFunc | None,
) -> dict[str, Any]:

    provider = key_input_func or input
    last_error = initial_error

    print(f"[decrypt] 自动获取 key 失败：{last_error}")
    print(
        "请输入 64 位十六进制数据库 key；"
        "输入 quit/退出可取消。"
    )

    while True:
        try:
            raw_value = provider("微信数据库 key：")
        except (EOFError, KeyboardInterrupt):
            return _fail("用户取消输入数据库 key")
        except Exception as e:
            return _fail(f"读取用户输入失败：{e}")

        raw_value = str(raw_value or "").strip()
        if not raw_value:
            print("输入不能为空。")
            continue

        command = _normalize_command(raw_value)

        if command in _EXIT_COMMANDS:
            return _fail("用户取消输入数据库 key")

        manual_key = _normalize_key(raw_value)
        if not _is_valid_key(manual_key):
            print(
                "key 格式不正确：应为 32 字节，也就是 64 个十六进制字符，"
                "不要包含引号。"
            )
            continue

        account_info = _resolve_v4_account_info(
            source_dir=source_dir,
            output_root=output_root,
        )
        if account_info is None:
            return _fail(
                "已经收到手动 key，但无法确定微信原始数据库目录。"
                "请调用时显式传入 source_dir。"
            )

        result = _dump_v4_with_key(
            key=manual_key,
            wxid=account_info["wxid"],
            wx_dir=account_info["source_dir"],
            output_root=output_root,
        )

        if result.get("ok"):
            # 只缓存已经验证成功的 key，错误 key 不写入缓存。
            return _finalize_success(
                result=result,
                output_root=output_root,
                db_version=db_version,
                key=manual_key,
                key_source="manual",
                from_cache_key=False,
            )

        last_error = result.get("message") or "key 与数据库不匹配"
        print(f"[decrypt] 解密失败：{last_error}")
        print("请重新输入正确的 key，或输入 auto 重新自动识别。")


# =========================
# cache helpers
# =========================


def _get_cache_path(output_root: Path) -> Path:
    return output_root / "decrypt_cache.json"


def _load_cache(output_root: Path) -> dict[str, Any]:
    cache_path = _get_cache_path(output_root)
    if not cache_path.exists():
        return {}

    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_cache(output_root: Path, cache: dict[str, Any]) -> None:
    cache_path = _get_cache_path(output_root)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def _update_cache(output_root: Path, **kwargs: Any) -> None:
    cache = _load_cache(output_root)
    for key, value in kwargs.items():
        if value is not None:
            cache[key] = value
    cache["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _save_cache(output_root, cache)


def _remove_cached_key(output_root: Path) -> None:
    cache = _load_cache(output_root)
    if "key" not in cache:
        return

    cache.pop("key", None)
    cache["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _save_cache(output_root, cache)


def clear_decrypt_cache(output_root: str | os.PathLike = ".") -> None:
    output_root_path = Path(output_root).expanduser().resolve()
    cache_path = _get_cache_path(output_root_path)
    if cache_path.exists():
        cache_path.unlink()


def _norm_path(path: str | os.PathLike | None) -> str | None:
    if not path:
        return None
    try:
        return str(Path(path).expanduser().resolve())
    except Exception:
        return str(path)


def _normalize_source_root(path: str | os.PathLike) -> Path:
    source_path = Path(path).expanduser().resolve()
    if source_path.name.lower() == "db_storage":
        return source_path.parent
    return source_path


def _same_path(
    path1: str | os.PathLike | None,
    path2: str | os.PathLike | None,
) -> bool:
    if not path1 or not path2:
        return False
    return _norm_path(path1) == _norm_path(path2)


def _cache_matches(
    cache: dict[str, Any],
    db_version: int,
    source_dir: str | None,
) -> bool:
    cached_db_version = cache.get("db_version")
    if cached_db_version is None:
        return False
    if int(cached_db_version) != int(db_version):
        return False

    if source_dir:
        cached_source_dir = cache.get("source_dir")
        if not _same_path(cached_source_dir, source_dir):
            return False

    return True


def _get_cached_db_dir(
    cache: dict[str, Any],
    db_version: int,
    source_dir: str | None,
) -> str | None:
    if not _cache_matches(cache, db_version, source_dir):
        return None

    cached_db_dir = cache.get("db_dir")
    if _db_dir_is_ready(cached_db_dir):
        return str(Path(cached_db_dir).resolve())
    return None


def _get_cached_key_info(
    cache: dict[str, Any],
    db_version: int,
    source_dir: str | None,
) -> dict[str, Any] | None:
    if not _cache_matches(cache, db_version, source_dir):
        return None

    key = _normalize_key(str(cache.get("key") or ""))
    wxid = cache.get("wxid")
    cached_source_dir = cache.get("source_dir")

    if not _is_valid_key(key):
        return None
    if not wxid:
        return None
    if not cached_source_dir:
        return None
    if not Path(cached_source_dir).exists():
        return None

    return {
        "key": key,
        "wxid": str(wxid),
        "source_dir": str(_normalize_source_root(cached_source_dir)),
    }


def _db_dir_is_ready(db_dir: str | os.PathLike | None) -> bool:
    if not db_dir:
        return False

    db_path = Path(db_dir)
    if not db_path.exists() or not db_path.is_dir():
        return False

    has_info = (db_path / "info.json").exists()
    has_db = any(db_path.rglob("*.db"))
    return has_info or has_db


# =========================
# decrypt helpers
# =========================


def _dump_v4_with_key(
    key: str,
    wxid: str,
    wx_dir: str,
    output_root: Path,
) -> dict[str, Any]:
    normalized_key = _normalize_key(key)
    if not _is_valid_key(normalized_key):
        return _fail("数据库 key 格式不正确，应为 64 个十六进制字符")

    wx_dir_path = _normalize_source_root(wx_dir)
    if not wx_dir_path.exists():
        return _fail(f"微信原始目录不存在：{wx_dir_path}")

    db_storage_dir = wx_dir_path / "db_storage"
    if not db_storage_dir.is_dir():
        return _fail(f"微信原始目录中不存在 db_storage：{db_storage_dir}")

    validation_db = _find_validation_db(db_storage_dir)
    if validation_db is None:
        return _fail(f"没有找到可用于校验 key 的数据库：{db_storage_dir}")

    try:
        key_matches = decrypt_v4.validate_key_v4(
            normalized_key,
            str(validation_db),
        )
    except Exception as e:
        return _fail(f"校验数据库 key 时出错：{e}")

    if not key_matches:
        return _fail("输入的 key 与当前微信数据库不匹配")

    me = Me()
    me.wx_dir = str(wx_dir_path)
    me.wxid = wxid

    try:
        me.xor_key = get_decode_code_v4(str(wx_dir_path))
    except Exception:
        # xor_key 只影响部分媒体解码，不应阻止数据库解密。
        me.xor_key = None

    final_output_dir = output_root / wxid
    temp_output_dir = output_root / f".{wxid}.decrypting"

    if temp_output_dir.exists():
        shutil.rmtree(temp_output_dir)

    try:
        summary = decrypt_v4.decrypt_db_files(
            normalized_key,
            src_dir=str(wx_dir_path),
            dest_dir=str(temp_output_dir),
        )
    except Exception as e:
        if temp_output_dir.exists():
            shutil.rmtree(temp_output_dir, ignore_errors=True)
        return _fail(f"批量解密数据库失败：{e}")

    if not summary.get("ok"):
        shutil.rmtree(temp_output_dir, ignore_errors=True)
        return _fail(
            "数据库批量解密失败："
            f"成功 {summary.get('success_count', 0)} 个，"
            f"失败 {summary.get('failed_count', 0)} 个"
        )

    temp_db_dir = temp_output_dir / "db_storage"
    if not _db_dir_is_ready(temp_db_dir):
        shutil.rmtree(temp_output_dir, ignore_errors=True)
        return _fail("解密结束，但没有生成可用的 db_storage 目录")

    info_path = temp_db_dir / "info.json"
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(me.to_json(), f, ensure_ascii=False, indent=4)

    try:
        _replace_directory(temp_output_dir, final_output_dir)
    except Exception as e:
        shutil.rmtree(temp_output_dir, ignore_errors=True)
        return _fail(
            "数据库已解密，但替换旧输出目录失败。"
            "请关闭正在占用解密数据库的程序后重试："
            f"{e}"
        )

    db_dir = final_output_dir / "db_storage"
    return _success(
        message="微信 4.0 数据库解析成功",
        db_dir=db_dir,
        wxid=wxid,
        source_dir=str(wx_dir_path),
        decrypt_summary=summary,
    )


def _resolve_v4_account_info(
    source_dir: str | None,
    output_root: Path,
) -> dict[str, Any] | None:
    """
    为手动 key 确定 wxid、昵称和原始数据库目录。

    优先使用当前进程自动检测的信息；检测不到时，回退到显式
    source_dir 和缓存元数据。手动 key 本身不依赖自动检测成功。
    """
    cache = _load_cache(output_root)

    try:
        wx_info_list = get_info_v4()
    except Exception:
        wx_info_list = []

    if wx_info_list:
        wx_info = _select_wx_info(wx_info_list, source_dir)
        if wx_info is not None and getattr(wx_info, "wx_dir", None):
            wx_dir = _normalize_source_root(getattr(wx_info, "wx_dir"))
            return {
                "wxid": str(
                    getattr(wx_info, "wxid", "")
                    or cache.get("wxid")
                    or wx_dir.name
                ),
                "source_dir": str(wx_dir),
            }

    resolved_source = source_dir or cache.get("source_dir")
    if not resolved_source:
        return None

    wx_dir = _normalize_source_root(resolved_source)
    if not wx_dir.exists():
        return None

    return {
        "wxid": str(cache.get("wxid") or wx_dir.name),
        "source_dir": str(wx_dir),
    }


def _find_validation_db(db_storage_dir: Path) -> Path | None:
    candidates = [
        db_storage_dir / "favorite" / "favorite_fts.db",
        db_storage_dir / "head_image" / "head_image.db",
        db_storage_dir / "contact" / "contact.db",
        db_storage_dir / "session" / "session.db",
    ]

    for path in candidates:
        if _is_encrypted_db_candidate(path):
            return path

    for path in db_storage_dir.rglob("*.db"):
        if path.name.lower() == "audio2text.db":
            continue
        if _is_encrypted_db_candidate(path):
            return path

    return None


def _is_encrypted_db_candidate(path: Path) -> bool:
    try:
        if not path.is_file() or path.stat().st_size < decrypt_v4.PAGE_SIZE:
            return False
        with open(path, "rb") as f:
            header = f.read(len(decrypt_v4.SQLITE_HEADER))
        # Plain SQLite files do not need the SQLCipher key and cannot be used
        # to validate it.
        return header != decrypt_v4.SQLITE_HEADER
    except OSError:
        return False


def _replace_directory(temp_dir: Path, final_dir: Path) -> None:
    backup_dir = final_dir.with_name(f".{final_dir.name}.backup")

    if backup_dir.exists():
        shutil.rmtree(backup_dir)

    had_old_dir = final_dir.exists()
    if had_old_dir:
        final_dir.rename(backup_dir)

    try:
        temp_dir.rename(final_dir)
    except Exception:
        if had_old_dir and backup_dir.exists() and not final_dir.exists():
            backup_dir.rename(final_dir)
        raise
    else:
        if backup_dir.exists():
            shutil.rmtree(backup_dir)


def _select_wx_info(
    wx_info_list: list[Any],
    source_dir: str | None,
) -> Any | None:
    if not source_dir:
        return wx_info_list[0]

    source_path = _normalize_source_root(source_dir)
    for wx_info in wx_info_list:
        wx_dir_value = getattr(wx_info, "wx_dir", None)
        if not wx_dir_value:
            continue
        wx_dir = _normalize_source_root(wx_dir_value)
        if wx_dir == source_path:
            return wx_info
    return None


def _normalize_command(value: str) -> str:
    return re.sub(r"[\s_\-]+", "", value).lower()


def _normalize_key(value: str) -> str:
    key = re.sub(r"\s+", "", str(value or "").strip())
    if key.lower().startswith("0x"):
        key = key[2:]
    return key.lower()


def _is_valid_key(key: str) -> bool:
    return bool(_HEX_KEY_PATTERN.fullmatch(key))


def _finalize_success(
    result: dict[str, Any],
    output_root: Path,
    db_version: int,
    key: str | None,
    key_source: str,
    from_cache_key: bool,
) -> dict[str, Any]:

    if not key or not _is_valid_key(_normalize_key(key)):
        return _fail("数据库已经解密，但没有获得可写入缓存的有效 key")

    normalized_key = _normalize_key(key)
    _update_cache(
        output_root,
        db_version=db_version,
        wxid=result.get("wxid"),
        source_dir=_norm_path(result.get("source_dir")),
        db_dir=_norm_path(result.get("db_dir")),
        key=normalized_key,
    )

    result["from_cache_db"] = False
    result["from_cache_key"] = from_cache_key
    result["key_source"] = key_source
    result["cache_path"] = str(_get_cache_path(output_root))

    if key_source == "manual":
        result["message"] = "手动输入 key 验证成功，已写入缓存并完成解密"
    elif key_source == "cache":
        result["message"] = "使用缓存 key 重新解密成功"

    return result


# =========================
# result helpers
# =========================


def _success(
    message: str,
    db_dir: Path,
    wxid: str | None,
    source_dir: str | None,
    **extra: Any,
) -> dict[str, Any]:
    result = {
        "ok": True,
        "message": message,
        "db_dir": str(db_dir.resolve()),
        "wxid": wxid,
        "source_dir": source_dir,
    }
    result.update(extra)
    return result


def _fail(message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "message": message,
        "db_dir": None,
        "wxid": None,
        "source_dir": None,
    }


def debug_wechat_info(db_version: int = 4) -> None:
    if db_version == 4:
        wx_info_list = get_info_v4()
    else:
        print(f"不支持的 db_version: {db_version}")
        return

    print(f"检测到微信账号数量: {len(wx_info_list)}")
    for i, wx_info in enumerate(wx_info_list):
        print("=" * 60)
        print(f"index: {i}")
        print(f"wxid: {getattr(wx_info, 'wxid', None)}")
        print(f"wx_dir: {getattr(wx_info, 'wx_dir', None)}")
        print(f"has_key: {bool(getattr(wx_info, 'key', None))}")

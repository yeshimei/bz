from __future__ import annotations

import hmac
import os
import struct
from concurrent.futures import ProcessPoolExecutor
from typing import Any

from Crypto.Cipher import AES
from Crypto.Hash import SHA512
from Crypto.Protocol.KDF import PBKDF2


IV_SIZE = 16
HMAC_SIZE = 64
KEY_SIZE = 32
AES_BLOCK_SIZE = 16
ROUND_COUNT = 256000
PAGE_SIZE = 4096
SALT_SIZE = 16
SQLITE_HEADER = b"SQLite format 3"


def _normalize_hex_key(pkey: str) -> str | None:
    """Normalize a 32-byte hexadecimal key."""
    if not isinstance(pkey, str):
        return None

    normalized = pkey.strip().lower()
    if normalized.startswith("0x"):
        normalized = normalized[2:]

    if len(normalized) != KEY_SIZE * 2:
        return None

    try:
        raw_key = bytes.fromhex(normalized)
    except ValueError:
        return None

    if len(raw_key) != KEY_SIZE:
        return None

    return normalized


def _derive_keys(pkey: str, salt: bytes) -> tuple[bytes, bytes]:
    """Derive the page encryption key and HMAC key."""
    passphrase = bytes.fromhex(pkey)
    mac_salt = bytes(value ^ 0x3A for value in salt)

    key = PBKDF2(
        passphrase,
        salt,
        dkLen=KEY_SIZE,
        count=ROUND_COUNT,
        hmac_hash_module=SHA512,
    )
    mac_key = PBKDF2(
        key,
        mac_salt,
        dkLen=KEY_SIZE,
        count=2,
        hmac_hash_module=SHA512,
    )
    return key, mac_key


def _reserve_size() -> int:
    reserve = IV_SIZE + HMAC_SIZE
    return (
        (reserve + AES_BLOCK_SIZE - 1)
        // AES_BLOCK_SIZE
        * AES_BLOCK_SIZE
    )


def _page_hmac_matches(
    page: bytes,
    mac_key: bytes,
    page_number: int,
    offset: int,
) -> bool:
    """Verify one encrypted database page."""
    reserve = _reserve_size()
    end = len(page)

    if end < offset + reserve:
        return False

    stored_mac_offset = end - reserve + IV_SIZE
    calculated_mac = hmac.new(
        mac_key,
        page[offset:stored_mac_offset],
        SHA512,
    )
    calculated_mac.update(struct.pack("<I", page_number))

    stored_mac = page[
        stored_mac_offset:stored_mac_offset + HMAC_SIZE
    ]
    return hmac.compare_digest(
        calculated_mac.digest(),
        stored_mac,
    )


def validate_key_v4(pkey: str, in_db_path: str) -> bool:
    """Validate a key against the first page without creating output."""
    normalized_key = _normalize_hex_key(pkey)
    if normalized_key is None or not os.path.isfile(in_db_path):
        return False

    try:
        with open(in_db_path, "rb") as f_in:
            salt = f_in.read(SALT_SIZE)
            encrypted_part = f_in.read(PAGE_SIZE - SALT_SIZE)

        if len(salt) != SALT_SIZE:
            return False
        if len(encrypted_part) != PAGE_SIZE - SALT_SIZE:
            return False

        page = salt + encrypted_part
        _key, mac_key = _derive_keys(normalized_key, salt)

        return _page_hmac_matches(
            page=page,
            mac_key=mac_key,
            page_number=1,
            offset=SALT_SIZE,
        )
    except (OSError, ValueError):
        return False


def decrypt_db_file_v4(
    pkey: str,
    in_db_path: str,
    out_db_path: str,
) -> bool:
    """Decrypt one WeChat 4.x database file."""
    normalized_key = _normalize_hex_key(pkey)
    if normalized_key is None:
        return False

    if not os.path.isfile(in_db_path):
        print(f"[DECRYPT ERROR] Database does not exist: {in_db_path}")
        return False

    os.makedirs(os.path.dirname(out_db_path) or ".", exist_ok=True)
    temp_output_path = f"{out_db_path}.part"

    try:
        with open(in_db_path, "rb") as f_in, open(
            temp_output_path,
            "wb",
        ) as f_out:
            salt = f_in.read(SALT_SIZE)
            if len(salt) != SALT_SIZE:
                return False

            key, mac_key = _derive_keys(normalized_key, salt)
            reserve = _reserve_size()

            f_out.write(SQLITE_HEADER)
            f_out.write(b"\x00")

            current_page = 0
            decrypted_page_count = 0

            while True:
                if current_page == 0:
                    encrypted_part = f_in.read(PAGE_SIZE - SALT_SIZE)
                    if not encrypted_part:
                        break
                    if len(encrypted_part) != PAGE_SIZE - SALT_SIZE:
                        return False
                    page = salt + encrypted_part
                else:
                    page = f_in.read(PAGE_SIZE)
                    if not page:
                        break
                    if len(page) != PAGE_SIZE:
                        return False

                offset = SALT_SIZE if current_page == 0 else 0
                end = len(page)

                if all(value == 0 for value in page):
                    f_out.write(page[offset:])
                    current_page += 1
                    decrypted_page_count += 1
                    continue

                if not _page_hmac_matches(
                    page=page,
                    mac_key=mac_key,
                    page_number=current_page + 1,
                    offset=offset,
                ):
                    return False

                iv_start = end - reserve
                iv = page[iv_start:iv_start + IV_SIZE]
                encrypted_data = page[offset:iv_start]

                if len(encrypted_data) % AES_BLOCK_SIZE != 0:
                    return False

                cipher = AES.new(key, AES.MODE_CBC, iv)
                decrypted_data = cipher.decrypt(encrypted_data)

                f_out.write(decrypted_data)
                f_out.write(page[iv_start:end])

                current_page += 1
                decrypted_page_count += 1

        if decrypted_page_count == 0:
            return False

        os.replace(temp_output_path, out_db_path)
        return True

    except (OSError, ValueError) as exc:
        print(f"[DECRYPT ERROR] {in_db_path}: {exc}")
        return False
    finally:
        if os.path.exists(temp_output_path):
            try:
                os.remove(temp_output_path)
            except OSError:
                pass


def decode_wrapper(task: tuple[str, str, str]) -> dict[str, Any]:
    """Run one decryption task in a worker process."""
    pkey, in_db_path, out_db_path = task

    try:
        ok = decrypt_db_file_v4(
            pkey=pkey,
            in_db_path=in_db_path,
            out_db_path=out_db_path,
        )
        return {
            "ok": ok,
            "source": in_db_path,
            "output": out_db_path,
            "error": None if ok else "key mismatch or decryption failed",
        }
    except Exception as exc:
        return {
            "ok": False,
            "source": in_db_path,
            "output": out_db_path,
            "error": repr(exc),
        }


def decrypt_db_files(
    key: str,
    src_dir: str,
    dest_dir: str,
) -> dict[str, Any]:
    """Decrypt all .db files and return a structured summary."""
    normalized_key = _normalize_hex_key(key)
    if normalized_key is None:
        return {
            "ok": False,
            "key_valid": False,
            "total_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "failed_files": [],
            "message": "Key must contain exactly 64 hexadecimal characters",
        }

    if not os.path.isdir(src_dir):
        return {
            "ok": False,
            "key_valid": False,
            "total_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "failed_files": [],
            "message": f"Source directory does not exist: {src_dir}",
        }

    decrypt_tasks: list[tuple[str, str, str]] = []

    for root, _dirs, files in os.walk(src_dir):
        for file_name in files:
            if not file_name.lower().endswith(".db"):
                continue

            src_file_path = os.path.join(root, file_name)
            relative_path = os.path.relpath(root, src_dir)
            dest_sub_dir = os.path.join(dest_dir, relative_path)
            dest_file_path = os.path.join(dest_sub_dir, file_name)

            decrypt_tasks.append(
                (
                    normalized_key,
                    src_file_path,
                    dest_file_path,
                )
            )

    if not decrypt_tasks:
        return {
            "ok": False,
            "key_valid": False,
            "total_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "failed_files": [],
            "message": f"No .db files found in: {src_dir}",
        }

    # Validate against available database files before creating outputs.
    key_valid = any(
        validate_key_v4(normalized_key, task[1])
        for task in decrypt_tasks
    )
    if not key_valid:
        return {
            "ok": False,
            "key_valid": False,
            "total_count": len(decrypt_tasks),
            "success_count": 0,
            "failed_count": len(decrypt_tasks),
            "failed_files": [],
            "message": "The key does not match the current database files",
        }

    os.makedirs(dest_dir, exist_ok=True)

    max_workers = min(
        16,
        max(1, os.cpu_count() or 1),
        len(decrypt_tasks),
    )
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(decode_wrapper, decrypt_tasks))

    failed_results = [result for result in results if not result["ok"]]
    success_count = len(results) - len(failed_results)

    return {
        "ok": success_count > 0,
        "key_valid": True,
        "total_count": len(results),
        "success_count": success_count,
        "failed_count": len(failed_results),
        "failed_files": failed_results,
        "message": f"Decrypted {success_count}/{len(results)} database files",
    }

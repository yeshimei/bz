#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""夸克网盘授权（2026-11-09 立）—— 给 scripts/push-quark.mjs 备 cookie。

做法：开一个带固定用户目录的浏览器窗口，登录态会一直留着；第一次需要手动扫码，
之后只要它没过期就不会再打扰。cookie 落在 ~/.bz-quark-cookie（不进仓库）。

依赖：Python 3 + playwright（`pip install playwright` 且 `python -m playwright install chromium`）。
用法：
    python scripts/quark-auth.py            # 有登录态就直接导出，没有就开窗等扫码
    python scripts/quark-auth.py --force    # 无视缓存，强制重新授权
"""
import json
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[quark-auth] 缺 playwright：pip install playwright && python -m playwright install chromium", flush=True)
    sys.exit(2)

PROFILE = Path.home() / ".bz-quark-profile"
COOKIE_FILE = Path.home() / ".bz-quark-cookie"
ACCOUNT_FILE = Path.home() / ".bz-quark-account.json"
# 登录后会出现在这些域下的会话 cookie（b-user-id 只是匿名设备号，不能当登录态）
DOMAINS = ("pan.quark.cn", ".quark.cn")


def log(msg):
    print(f"[quark-auth] {msg}", flush=True)


def probe(page):
    """会员接口能返回 code 0 且带昵称/会员类型，才算真登录。"""
    try:
        info = page.evaluate(
            """async () => {
                const r = await fetch('https://pan.quark.cn/1/clouddrive/member?pr=ucpro&fr=pc', {credentials:'include'});
                return await r.json();
            }"""
        )
    except Exception as e:  # 页面还没加载好
        return None, {"error": str(e)}
    if info.get("code") == 0 and (info.get("data") or {}).get("member_type"):
        return True, info
    return False, info


def main():
    force = "--force" in sys.argv
    PROFILE.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            headless=False,
            viewport={"width": 1440, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://pan.quark.cn/list", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(1500)

        ok, info = (False, {}) if force else probe(page)
        if ok:
            log(f"已有登录态：{info['data'].get('member_type')}，直接导出")
        else:
            log("请在打开的窗口里扫码登录（10 分钟内有效）")
            deadline = time.time() + 600
            while time.time() < deadline:
                ok, info = probe(page)
                if ok:
                    log(f"登录成功：{info['data'].get('member_type')}")
                    break
                time.sleep(2)
            if not ok:
                log(f"超时，没有拿到有效登录态（最后一次回包：{json.dumps(info, ensure_ascii=False)[:300]}）")
                ctx.close()
                return 2

        # 只留请求 pan.quark.cn 时会真正携带的 cookie，同名时 pan.quark.cn 域优先
        picked = {}
        for c in ctx.cookies():
            if c["domain"] not in DOMAINS or not c.get("value"):
                continue
            if c["name"] not in picked or c["domain"] == "pan.quark.cn":
                picked[c["name"]] = c["value"]

        COOKIE_FILE.write_text("; ".join(f"{k}={v}" for k, v in picked.items()), encoding="utf-8")
        ACCOUNT_FILE.write_text(json.dumps(info.get("data", {}), ensure_ascii=False, indent=2), encoding="utf-8")
        log(f"已写入 {COOKIE_FILE}（{len(picked)} 条 cookie），push-quark 可以直接用了")
        ctx.close()
        return 0


if __name__ == "__main__":
    sys.exit(main())

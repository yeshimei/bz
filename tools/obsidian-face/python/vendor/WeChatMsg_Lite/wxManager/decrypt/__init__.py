#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
@Time        : 2025/1/10 2:34 
@Author      : SiYuan 
@Email       : 863909694@qq.com 
@File        : wxManager-__init__.py.py 
@Description : 
"""
from typing import List

import psutil

from wxManager.decrypt.wx_info_v4 import dump_wechat_account_info_v4
from wxManager.decrypt.common import WeChatInfo


def get_info_v4() -> List[WeChatInfo]:
    """
    确定当前微信账号的 wxid、昵称和数据库目录。

    优先：
    1. 自动识别微信账号信息；
    2. 显式 source_dir；
    3. 缓存中的 source_dir。

    这里不会获取数据库 Key。
    """
    result_v4 = []

    for process in psutil.process_iter(
        ["name", "exe", "pid"]
    ):
        if process.name() != "Weixin.exe":
            continue

        wechat_base_address = 0

        for module in process.memory_maps(
            grouped=False
        ):
            if (
                module.path
                and "Weixin.dll" in module.path
            ):
                wechat_base_address = int(
                    module.addr,
                    16,
                )
                break

        if wechat_base_address == 0:
            continue

        wxinfo = (
            dump_wechat_account_info_v4(
                process.pid
            )
        )

        if wxinfo is not None:
            result_v4.append(wxinfo)

    return result_v4


if __name__ == "__main__":
    import json

    file_path = r'E:\Project\Python\MemoTrace\resources\data\version_list.json'
    with open(file_path, "r", encoding="utf-8") as f:
        version_list = json.loads(f.read())

    r_4 = get_info_v4()

    for wx_info in r_4:
        print(wx_info)
import logging
import time
import traceback
from functools import wraps
from pathlib import Path

filename = time.strftime("%Y-%m-%d", time.localtime())

logger = logging.getLogger("wechat_msg_lite")
logger.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    "%(asctime)s - %(name)s - "
    "%(filename)s[line:%(lineno)d] - "
    "%(levelname)s: %(message)s"
)

# bz-face vendor 偏离：日志目录用本文件定位而非 CWD——插件派生本工具时 CWD 是 Obsidian
# 安装目录（不可写），模块顶层 mkdir 会直接 WinError 5。语义不变，只换锚点。
log_dir = Path(__file__).resolve().parents[2] / "logs" / "wechat_msg_lite"
log_dir.mkdir(parents=True, exist_ok=True)

file_handler = logging.FileHandler(
    log_dir / f"{filename}.log",
    encoding="utf-8",
)

file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

stream_handler = logging.StreamHandler()
stream_handler.setLevel(logging.DEBUG)
stream_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(stream_handler)


def log(func):
    @wraps(func)
    def log_(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(
                f"\n{func.__qualname__} is error,params:{(args, kwargs)},here are details:\n{traceback.format_exc()}")
    return log_

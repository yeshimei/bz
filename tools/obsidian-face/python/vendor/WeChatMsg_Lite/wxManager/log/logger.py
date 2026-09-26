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

log_dir = Path.cwd() / "logs" / "wechat_msg_lite"
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

import os
from pathlib import Path

APP_NAME = "Novel2Script"


def get_app_data_dir() -> Path:
    """获取应用数据目录。
    可通过 APP_DATA_DIR 环境变量显式指定；
    否则默认使用 backend/ 目录自身（沙箱兼容）。"""
    env_dir = os.getenv("APP_DATA_DIR")
    if env_dir:
        path = Path(env_dir)
    else:
        # 默认使用 backend 目录，沙箱环境兼容
        path = Path(__file__).resolve().parent.parent  # 即 backend/
    path.mkdir(parents=True, exist_ok=True)
    return path


APP_DATA_DIR = get_app_data_dir()
DATABASE_PATH = APP_DATA_DIR / "app.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH.as_posix()}"

PORT = int(os.getenv("PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# 生成文件存储目录
OUTPUT_DIR = APP_DATA_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

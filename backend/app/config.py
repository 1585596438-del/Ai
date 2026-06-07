import os
from pathlib import Path

APP_NAME = "Novel2Script"


def get_app_data_dir() -> Path:
    """获取应用数据目录，桌面版使用本地 AppData"""
    env_dir = os.getenv("APP_DATA_DIR")
    if env_dir:
        path = Path(env_dir)
    else:
        # Windows: %APPDATA%/Novel2Script
        appdata = os.getenv("APPDATA") or os.path.expanduser("~")
        path = Path(appdata) / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


APP_DATA_DIR = get_app_data_dir()
DATABASE_PATH = APP_DATA_DIR / "app.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

PORT = int(os.getenv("PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# 生成文件存储目录
OUTPUT_DIR = APP_DATA_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

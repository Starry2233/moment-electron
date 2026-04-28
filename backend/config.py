"""
Configuration system for moment-electron.
Config stored at ~/.moment/config.json
"""

import json
from pathlib import Path

CONFIG_DIR = Path.home() / ".moment"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_CONFIG = {
    "mode": "lite",  # "lite" or "full"
    "full": {
        "aes_key": "",
        "eebbk_key": "",
        "key_id": "",
        "watch_id": "",
        "device_id": "",
        "token": "",
        "mac": "",
    },
}


def ensure_config_dir():
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    ensure_config_dir()
    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            merged = DEFAULT_CONFIG.copy()
            merged["mode"] = data.get("mode", DEFAULT_CONFIG["mode"])
            merged["full"].update(data.get("full", {}))
            return merged
        except Exception:
            return DEFAULT_CONFIG.copy()
    return DEFAULT_CONFIG.copy()


def save_config(config: dict):
    ensure_config_dir()
    CONFIG_FILE.write_text(
        json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def set_mode(mode: str):
    if mode not in ("lite", "full"):
        raise ValueError(f"Invalid mode: {mode}")
    config = load_config()
    config["mode"] = mode
    save_config(config)


def set_full_config(**kwargs):
    config = load_config()
    config["full"].update({k: v for k, v in kwargs.items() if v is not None})
    save_config(config)

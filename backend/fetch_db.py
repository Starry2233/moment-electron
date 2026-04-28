from typing import Optional
from pathlib import Path
from adbutils import AdbClient
import tempfile
import time

MOMENT_DB_PATH = "/data/data/com.xtc.moment/databases/moment.db"
MOMENT_DB_OUTPUT = Path(tempfile.gettempdir()) / "moment.db"

def fetch_db(device_id: Optional[str | None] = None, output: Optional[Path | str] = MOMENT_DB_OUTPUT, **kwargs) -> Path:
    client = AdbClient(host=kwargs.get("adb_host", "127.0.0.1"), port=kwargs.get("adb_port", 5037))
    if len(client.device_list()) == 0:
        raise RuntimeError("No connected devices found")
    device = client.device(device_id) if device_id else client.device()
    # if not device.sync.exists(kwargs.get("su_path", "/system/xbin/su")):
    #     raise RuntimeError("Device does not have su binary, can't fetch the database")
    device.shell(f"su -c 'cp {MOMENT_DB_PATH} /data/local/tmp/moment.db'", timeout=kwargs.get("shell_timeout", 10))
    device.shell(f"su -c 'chmod 777 /data/local/tmp/moment.db'", timeout=kwargs.get("shell_timeout", 10))
    device.sync.pull_file("/data/local/tmp/moment.db", str(output))
    device.shell("rm /data/local/tmp/moment.db", timeout=kwargs.get("shell_timeout", 10))
    return Path(output)

def flush_moment(device_id: Optional[str | None] = None, **kwargs) -> None:
    client = AdbClient(host=kwargs.get("adb_host", "127.0.0.1"), port=kwargs.get("adb_port", 5037))
    if len(client.device_list()) == 0:
        raise RuntimeError("No connected devices found")
    device = client.device(device_id) if device_id else client.device()
    device.app_stop("com.xtc.moment")
    time.sleep(0.5)
    device.app_start("com.xtc.moment", activity="com.xtc.moment.module.main.MomentActivity")
    time.sleep(1)
    
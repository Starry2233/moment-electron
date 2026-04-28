"""
好友圈 Python Backend (FastAPI)
Serves xtcmomentutils functionality via HTTP for the Electron frontend.

Compile with Nuitka:
    nuitka --standalone --onefile --windows-console-mode=disable main.py
"""

import sys
import os
import json
import time
import asyncio
import socket
import tempfile
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# ── Add parent to path for xtcmomentutils ──
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Try importing xtcmomentutils (supports both dev and compiled modes)
try:
    from xtcmomentutils.parser import MomentDBParser
    from xtcmomentutils.sort_json import MomentProcessor
except ImportError:
    from .xtcmomentutils.parser import MomentDBParser
    from .xtcmomentutils.sort_json import MomentProcessor

from fetch_db import fetch_db, flush_moment
from config import load_config, save_config, set_mode, set_full_config
from full_client import FullModeClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
logger = logging.getLogger("moment-backend")


def _find_free_port() -> int:
    """Find a free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _fetch_and_parse(device_id: str | None = None) -> list[dict]:
    """Pull DB from device via ADB, parse, return moments list."""
    db_path = fetch_db(device_id)
    parser = MomentDBParser(db_path)
    moments = parser.get_json_object("moment").get("moment", [])
    parser.close()
    db_path.unlink(missing_ok=True)
    logger.info(f"Fetched {len(moments)} moments from device={device_id or 'auto'}")

    # Resolve names via watchId lookup
    name_map: dict[str, str] = {}
    for m in moments:
        wid = m.get("watchId")
        name = m.get("name")
        if wid and name and isinstance(name, str) and name.strip():
            name_map[wid] = name.strip()
    for m in moments:
        wid = m.get("watchId")
        if wid and not m.get("name") and wid in name_map:
            m["name"] = name_map[wid]

    return moments


def _parse_moment_content(m: dict) -> dict:
    """Parse a moment's content/resource fields into a normalized structure.

    Returns a dict with keys:
      - kind: "text" | "image" | "multi_image" | "video" | "app_share" | "sticker" | "album" | "unknown"
      - text: extracted display text (str or None)
      - images: list of {url, key} (thumbnails / icons)
      - video: {url, key, thumbnail_url, thumbnail_key, duration} or None
      - app: {name, icon, desc, link} or None
    """
    result: dict = {
        "kind": "text",
        "text": None,
        "images": [],
        "video": None,
        "app": None,
    }

    raw_content = m.get("content")
    mtype = m.get("type", -1)

    # ── Parse content JSON ──
    content_obj = None
    if isinstance(raw_content, str) and raw_content.strip().startswith("{"):
        try:
            content_obj = json.loads(raw_content)
        except json.JSONDecodeError:
            content_obj = None

    # ── Extract text ──
    if content_obj:
        # Type 27: video with text inside videoMsgContent.content.content
        if mtype == 27:
            vm_str = content_obj.get("videoMsgContent") or "{}"
            if isinstance(vm_str, str) and vm_str.startswith("{"):
                try:
                    vm = json.loads(vm_str)
                    inner = vm.get("content") or "{}"
                    if isinstance(inner, str) and inner.startswith("{"):
                        inner_obj = json.loads(inner)
                        result["text"] = inner_obj.get("content") or inner.get("content")
                    else:
                        result["text"] = inner if isinstance(inner, str) else vm.get("content")
                except json.JSONDecodeError:
                    result["text"] = content_obj.get("content") or content_obj.get("desc")
            result["text"] = result["text"] or content_obj.get("content") or content_obj.get("desc")
        else:
            # App sharing types have "desc" as the text
            result["text"] = content_obj.get("desc") or content_obj.get("content") or content_obj.get("appName")
        if not isinstance(result["text"], str):
            result["text"] = None
    else:
        # Plain text content
        if isinstance(raw_content, str) and raw_content.strip() and not raw_content.strip().startswith("{"):
            result["text"] = raw_content

    # ── Determine kind and extract media ──
    if mtype == 27:
        # Video
        result["kind"] = "video"
        if content_obj:
            vm_str = content_obj.get("videoMsgContent") or "{}"
            if isinstance(vm_str, str) and vm_str.startswith("{"):
                try:
                    vm = json.loads(vm_str)
                    src = vm.get("source") or {}
                    icon = vm.get("icon") or {}
                    result["video"] = {
                        "url": src.get("downloadUrl"),
                        "key": src.get("key"),
                        "thumbnail_url": icon.get("downloadUrl"),
                        "thumbnail_key": icon.get("key"),
                        "duration": vm.get("videoLength"),
                    }
                    if icon.get("downloadUrl"):
                        result["images"].append({
                            "url": icon["downloadUrl"],
                            "key": icon.get("key", ""),
                        })
                except json.JSONDecodeError:
                    pass

    elif mtype == 26:
        # Multi-image (type 26 has multiple URLs in content.resource.downloadUrl)
        result["kind"] = "multi_image"
        if content_obj:
            res = content_obj.get("resource") or {}
            download_urls = res.get("downloadUrl", "")
            # Also get keys from the resource field on the moment
            res_keys_raw = m.get("resource", "")
            res_keys = [k.strip() for k in res_keys_raw.split(",") if k.strip()] if isinstance(res_keys_raw, str) else []
            urls = [u.strip() for u in download_urls.split(",") if u.strip()] if isinstance(download_urls, str) else []
            for i, url in enumerate(urls):
                key = res_keys[i] if i < len(res_keys) else ""
                result["images"].append({"url": url, "key": key})

    elif mtype in (5, 6):
        # Type 5: single image, Type 6: video (mostly) or album
        if mtype == 6 and content_obj:
            src = content_obj.get("source") or {}
            if not isinstance(src, dict):
                src = {}
            src_url = src.get("downloadUrl", "") or ""
            has_video_length = content_obj.get("videoLength") is not None
            is_video = has_video_length or "video" in str(src_url)

            if is_video:
                result["kind"] = "video"
                icon = content_obj.get("icon") or {}
                if not isinstance(icon, dict):
                    icon = {}
                result["video"] = {
                    "url": src.get("downloadUrl"),
                    "key": src.get("key"),
                    "thumbnail_url": icon.get("downloadUrl"),
                    "thumbnail_key": icon.get("key"),
                    "duration": content_obj.get("videoLength"),
                }
                if icon.get("downloadUrl"):
                    result["images"].append({"url": icon["downloadUrl"], "key": icon.get("key", "")})
            elif content_obj:
                # Album share with image
                result["kind"] = "image"
                img_src = content_obj.get("source") or content_obj.get("icon") or {}
                if isinstance(img_src, dict):
                    url = img_src.get("downloadUrl") or content_obj.get("downloadUrl")
                    key = img_src.get("key") or m.get("resource", "")
                    if url:
                        result["images"].append({"url": url, "key": key})
                    img_icon = content_obj.get("icon") or {}
                    if isinstance(img_icon, dict) and img_icon.get("downloadUrl") and img_icon["downloadUrl"] != url:
                        result["images"].append({"url": img_icon["downloadUrl"], "key": img_icon.get("key", "")})
        else:
            # Type 5: single image
            result["kind"] = "image"
            if content_obj:
                src = content_obj.get("source") or {}
                if isinstance(src, dict):
                    url = src.get("downloadUrl")
                    key = src.get("key") or m.get("resource", "")
                    if url:
                        result["images"].append({"url": url, "key": key})

    elif mtype in (7, 8, 9, 24, 25):
        # App sharing
        result["kind"] = "app_share"
        if content_obj:
            icon = content_obj.get("source") or content_obj.get("icon") or {}
            result["app"] = {
                "name": content_obj.get("appName"),
                "icon": icon.get("downloadUrl") or content_obj.get("appIcon"),
                "desc": content_obj.get("desc") or content_obj.get("content"),
                "link": content_obj.get("webLink"),
            }
            if result["app"]["icon"] and isinstance(result["app"]["icon"], str) and not result["app"]["icon"].startswith("http"):
                # Base64 icon, remove from images
                result["app"]["icon"] = None

    elif mtype in (0, 1):
        # Sticker / URL resource
        res_url = m.get("resource")
        if res_url and isinstance(res_url, str) and res_url.startswith("http"):
            result["kind"] = "sticker"
            result["images"].append({"url": res_url, "key": ""})

    # ── Clean up ──
    # Remove null/empty images
    result["images"] = [img for img in result["images"] if img.get("url")]
    # Ensure text isn't raw JSON
    if result["text"] and isinstance(result["text"], str) and result["text"].strip().startswith("{"):
        try:
            json.loads(result["text"])
            result["text"] = None  # it's still JSON, hide it
        except json.JSONDecodeError:
            pass

    return result


def _fetch_comments(device_id: str | None = None) -> list[dict]:
    """Pull DB from device via ADB, parse, return comments list."""
    db_path = fetch_db(device_id)
    parser = MomentDBParser(db_path)
    comments = parser.get_json_object("moment_comment").get("moment_comment", [])
    parser.close()
    db_path.unlink(missing_ok=True)
    logger.info(f"Fetched {len(comments)} comments from device={device_id or 'auto'}")
    return comments


# ── V3 Key Management ──

def getkey(timeout: int = 60) -> dict | None:
    """Use Frida to hook com.xtc.moment and retrieve V3 AES keys.

    Tries attach first (app already running → user is active).
    Falls back to spawn + ADB broadcast to trigger key refresh.
    Blocks up to `timeout` seconds.
    """
    try:
        import frida
    except ImportError:
        logger.error("frida-tools not installed. Run: pip install frida-tools")
        return None

    JS_HOOK = """
    Java.perform(function() {
        var AppInfo = Java.use("com.xtc.httplib.bean.AppInfo");
        AppInfo.setEncryptEebbkKey.implementation = function(str) {
            this.setEncryptEebbkKey(str);
            send({
                type: "key_update",
                keyId: this.keyId.value,
                aesKey: this.aesKey.value,
                encryptEebbkKey: this.encryptEebbkKey.value
            });
        };
        send({type: "ready"});
    });
    """

    result = None

    def on_message(message, data):
        nonlocal result
        if message["type"] == "send":
            payload = message["payload"]
            if payload.get("type") == "key_update":
                result = {
                    "keyId": payload["keyId"],
                    "aesKey": payload["aesKey"],
                    "encryptEebbkKey": payload["encryptEebbkKey"],
                }
                logger.info("Frida got key_update, keyId=%s", payload["keyId"])

    try:
        device = frida.get_usb_device()
    except Exception as e:
        logger.error("Frida: cannot connect USB device: %s", e)
        return None

    # ── Try attach first (app already running → user active) ──
    try:
        session = device.attach("com.xtc.moment")
        logger.info("Frida: attached to running com.xtc.moment")
    except Exception:
        # ── Spawn if not running ──
        try:
            pid = device.spawn(["com.xtc.moment"])
            logger.info("Frida: spawned com.xtc.moment, pid=%d", pid)
            session = device.attach(pid)
            device.resume(pid)
            # Send broadcast to force key refresh
            try:
                import subprocess
                subprocess.run(
                    ["adb", "shell", "am", "broadcast", "-a",
                     "com.xtc.initservice.action.NET_PARAM_UPDATE"],
                    capture_output=True, timeout=5
                )
                logger.info("Frida: sent NET_PARAM_UPDATE broadcast")
            except Exception:
                pass
        except Exception as e:
            logger.error("Frida: cannot spawn or attach: %s", e)
            return None

    # Inject hook
    script = session.create_script(JS_HOOK)
    script.on("message", on_message)
    script.load()

    logger.info("Frida: 请在手表上操作（刷新好友圈、发动态等）以触发密钥更新")
    logger.info("Frida: waiting for key_update (timeout=%ds)...", timeout)

    for _ in range(timeout):
        if result is not None:
            break
        time.sleep(1)

    session.detach()

    if result:
        set_full_config(
            aes_key=result["aesKey"],
            eebbk_key=result["encryptEebbkKey"],
            key_id=result["keyId"],
        )
        logger.info("Frida: keys saved to config")
    else:
        logger.warning("Frida: timeout, no key received")

    return result


# ── FastAPI App ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Moment backend started")
    yield
    logger.info("Moment backend shutting down")


app = FastAPI(title="Moment Backend", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DeviceInfo(BaseModel):
    serial: str
    state: str


class MomentResponse(BaseModel):
    moments: list[dict]
    total: int


# ── Config Models ──

class ConfigOut(BaseModel):
    mode: str
    full_configured: bool
    has_aes_key: bool
    has_watch_id: bool


class ModeSet(BaseModel):
    mode: str


class FullConfigIn(BaseModel):
    aes_key: str = ""
    eebbk_key: str = ""
    key_id: str = ""
    watch_id: str = ""
    device_id: str = ""
    token: str = ""
    mac: str = ""


# ── Full Mode Action Models ──

class CommentIn(BaseModel):
    momentId: str
    momentWatchId: str
    comment: str
    replyId: str | None = None


class LikeIn(BaseModel):
    momentId: str
    momentWatchId: str
    emotionId: int = 0


class PostMomentIn(BaseModel):
    content: str
    type: int = 3


@app.get("/api/devices")
async def list_devices() -> list[DeviceInfo]:
    """List connected ADB devices."""
    try:
        from adbutils import AdbClient
        client = AdbClient(host="127.0.0.1", port=5037)
        devices = []
        for d in client.device_list():
            devices.append(DeviceInfo(serial=d.serial, state="device"))
        return devices
    except Exception as e:
        logger.error(f"Failed to list devices: {e}")
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/moments")
async def get_moments(
    device_id: str | None = Query(None, description="Device serial"),
    from_ts: int | None = Query(None, alias="from"),
    to_ts: int | None = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=500),
) -> MomentResponse:
    """Get moments, optionally filtered by time range."""
    moments = _fetch_and_parse(device_id)
    if from_ts is not None:
        to_ts = to_ts or int(time.time() * 1000)
        moments = [m for m in moments if m.get("createTime") and from_ts <= m["createTime"] <= to_ts]
    moments.sort(key=lambda x: x.get("createTime", 0) or 0, reverse=True)
    # Add parsed content to each moment
    for m in moments[:limit]:
        m["parsed"] = _parse_moment_content(m)
    return MomentResponse(moments=moments[:limit], total=len(moments))


@app.post("/api/moments/refresh")
async def refresh_moments(device_id: str | None = Query(None)):
    """Force refresh moments on device."""
    try:
        flush_moment(device_id)
        return {"status": "ok", "message": "好友圈数据已刷新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/moments/{moment_id}/images")
async def get_moment_images(moment_id: str, device_id: str | None = Query(None)):
    """Get image URLs for a specific moment."""
    moments = _fetch_and_parse(device_id)
    matched = [m for m in moments if m.get("momentId") == moment_id]
    if not matched:
        raise HTTPException(status_code=404, detail=f"未找到 momentId={moment_id}")

    moment = matched[0]
    resource = moment.get("resource")
    content_raw = moment.get("content")

    resource_keys: list[str] = []
    if resource and resource != "null":
        if isinstance(resource, str) and resource.startswith("{"):
            try:
                r = json.loads(resource)
                if r.get("picKey"):
                    resource_keys.append(r["picKey"])
            except json.JSONDecodeError:
                pass
        else:
            for p in (resource.split(",") if isinstance(resource, str) else [resource]):
                p = p.strip()
                if p:
                    resource_keys.append(p)

    url_to_key: dict[str, str] = {}
    if content_raw and isinstance(content_raw, str) and content_raw.startswith("{"):
        try:
            c = json.loads(content_raw)
            for field in ("resource", "source"):
                obj = c.get(field) or {}
                if obj.get("downloadUrl"):
                    url_to_key[obj["downloadUrl"]] = obj.get("key", "")
        except json.JSONDecodeError:
            pass

    images = []
    for k in dict.fromkeys(resource_keys):
        url = next((u for u, v in url_to_key.items() if v == k), None)
        images.append({"key": k, "url": url})

    return {"moment_id": moment_id, "images": images, "total": len(images)}


@app.get("/api/moments/{moment_id}/comments")
async def get_moment_comments(moment_id: str, device_id: str | None = Query(None)):
    """Get comments for a specific moment."""
    all_comments = _fetch_comments(device_id)
    filtered = [
        c for c in all_comments
        if c.get("momentId") == moment_id
    ]
    filtered.sort(key=lambda x: x.get("createTime", 0) or 0)
    return {"moment_id": moment_id, "comments": filtered, "total": len(filtered)}


@app.get("/api/health")
async def health():
    return {"status": "ok", "time": time.time()}


# ── Config Endpoints ──

@app.get("/api/config")
async def get_config() -> ConfigOut:
    cfg = load_config()
    full = cfg.get("full", {})
    return ConfigOut(
        mode=cfg.get("mode", "lite"),
        full_configured=bool(full.get("aes_key") and full.get("eebbk_key")),
        has_aes_key=bool(full.get("aes_key")),
        has_watch_id=bool(full.get("watch_id")),
    )


@app.post("/api/config/mode")
async def change_mode(body: ModeSet):
    try:
        set_mode(body.mode)
        return {"status": "ok", "mode": body.mode}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/config/full")
async def get_full_config():
    """Return full mode config values."""
    cfg = load_config()
    full = cfg.get("full", {})
    return {
        "aes_key": full.get("aes_key", ""),
        "eebbk_key": full.get("eebbk_key", ""),
        "key_id": full.get("key_id", ""),
        "watch_id": full.get("watch_id", ""),
        "device_id": full.get("device_id", ""),
        "token": full.get("token", ""),
        "mac": full.get("mac", ""),
    }


@app.post("/api/config/full")
async def update_full_config(body: FullConfigIn):
    set_full_config(**body.model_dump())
    return {"status": "ok"}


# ── Getkey Endpoint ──

@app.post("/api/getkey")
async def api_getkey():
    """Run Frida hook to extract V3 keys from the device."""
    result = getkey(timeout=30)
    if result:
        return {"status": "ok", "keyId": result["keyId"], "aesKey": result["aesKey"]}
    raise HTTPException(status_code=500, detail="获取密钥失败，请确保手表已连接且 frida-server 正在运行")


# ── Full Mode Action Endpoints ──

def _require_full_client() -> FullModeClient:
    """Get FullModeClient or raise 400 if config is incomplete."""
    cfg = load_config()
    if cfg.get("mode") != "full":
        raise HTTPException(status_code=400, detail="当前为 Lite 模式，请先切换到 Full 模式")
    full = cfg.get("full", {})
    missing = [k for k in ("aes_key", "eebbk_key", "key_id", "watch_id", "device_id", "token") if not full.get(k)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Full 模式配置不完整，缺少: {', '.join(missing)}")
    return FullModeClient(full)


@app.post("/api/full/comment")
async def full_comment(body: CommentIn):
    client = _require_full_client()
    try:
        resp = client.comment(body.momentId, body.momentWatchId, body.comment, body.replyId)
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/full/like")
async def full_like(body: LikeIn):
    client = _require_full_client()
    try:
        resp = client.like(body.momentId, body.momentWatchId, body.emotionId)
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/full/post")
async def full_post(body: PostMomentIn):
    client = _require_full_client()
    try:
        resp = client.post_moment(body.content, body.type)
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry Point ──

def main():
    port = _find_free_port()
    # Tell Electron which port we're on (first line of stdout)
    print(json.dumps({"type": "ready", "port": port}), flush=True)

    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()

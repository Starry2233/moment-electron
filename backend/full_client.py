"""
Full mode V3 API client.
Wraps xtcv3utils for comment/like/post operations.
"""

import json
import uuid
import time
import logging

import requests
from xtcv3utils import V3Client

logger = logging.getLogger("moment-backend.full")


class FullModeClient:
    """V3 API client for Full mode operations."""

    BASE_URL = "https://moment.watch.okii.com"

    def __init__(self, full_config: dict):
        self.config = full_config
        logger.info("FullClient init: watch_id=%s device_id=%s token=%s mac=%s",
                     full_config.get("watch_id","")[:20],
                     full_config.get("device_id","")[:16],
                     full_config.get("token","")[:16],
                     full_config.get("mac",""))
        self.client = V3Client(
            aes_key=full_config["aes_key"],
            eebbk_key=full_config["eebbk_key"],
            key_id=full_config["key_id"],
            watch_id=full_config["watch_id"],
            device_id=full_config["device_id"],
            token=full_config["token"],
            mac=full_config.get("mac", ""),
            model=full_config.get("model", "watch"),
            package_version=full_config.get("package_version", "1"),
        )

    def _encrypt_request(self, url: str, body: str) -> tuple[str, dict, str | None]:
        url_uuid = uuid.uuid4().hex
        full_url = f"{url}?uuid={url_uuid}"
        headers, encrypted_body = self.client.encrypt_request(full_url, body)

        # Log the full request details (no truncation)
        logger.info("=== Encrypt Request ===")
        logger.info("URL: %s", full_url)
        logger.info("Body (plain): %s", body)
        logger.info("Base-Request-Param len=%d: %s", len(headers.get("Base-Request-Param", "")), headers.get("Base-Request-Param", ""))
        logger.info("Eebbk-Sign: %s", headers.get("Eebbk-Sign", ""))
        logger.info("Encrypted Body len=%d: %s", len(encrypted_body or ""), encrypted_body or "N/A")
        # Log all headers
        for k, v in sorted(headers.items()):
            logger.info("  Header %s: %s", k, v[:120])

        headers["uuid"] = str(uuid.uuid4())
        headers["dataCenterCode"] = "CN_BJ"
        headers["Version"] = "W_1.9.0"
        headers["Grey"] = "0"
        headers["Accept-Language"] = "zh-CN"
        headers["Watch-Time-Zone"] = "GMT+08:00"
        headers["User-Agent"] = "okhttp/3.12.0"
        headers["Accept-Encoding"] = "gzip"
        return full_url, headers, encrypted_body

    def _decrypt_response(self, resp_text: str) -> dict:
        plain = self.client.decrypt_response(resp_text, is_encrypted=True)
        obj = json.loads(plain)
        logger.info("=== Decrypt Response ===")
        logger.info("Raw: %s", resp_text[:100])
        logger.info("Plain: %s", json.dumps(obj, ensure_ascii=False)[:500])
        return obj

    def _request(self, url_path: str, body: dict) -> dict:
        """Make an encrypted V3 request with logging."""
        url = f"{self.BASE_URL}{url_path}"
        body_str = json.dumps(body, separators=(",", ":"))
        full_url, headers, encrypted = self._encrypt_request(url, body_str)
        logger.info("POST %s", full_url)
        resp = requests.post(full_url, headers=headers, data=encrypted)
        logger.info("Response status: %d", resp.status_code)
        logger.info("Response headers: %s", dict(resp.headers))
        logger.info("Response body(raw): %s", resp.text[:200])
        result = self._decrypt_response(resp.text)
        logger.info("Result: code=%s desc=%s", result.get("code",""), result.get("desc",""))
        return result

    def search_moments(
        self, watch_id: str | None = None, friend: int = 1, begin: int = 0, size: int = 10
    ) -> dict:
        """Search/feed moments."""
        return self._request("/moment/search", {
            "begin": begin,
            "commentPageSize": 5,
            "currentWatchId": self.config["watch_id"],
            "end": int(time.time() * 1000),
            "friend": friend,
            "from": 0,
            "lastLikeTime": int(time.time() * 1000),
            "searchPermission": 1,
            "size": size,
            "watchId": watch_id or self.config["watch_id"],
        })

    def comment(
        self,
        moment_id: str,
        moment_watch_id: str,
        text: str,
        reply_id: str | None = None,
    ) -> dict:
        """Comment on a moment, or reply to a comment."""
        body = {
            "comment": text,
            "momentId": moment_id,
            "momentWatchId": moment_watch_id,
            "watchId": self.config["watch_id"],
        }
        if reply_id:
            body["replyId"] = reply_id
        return self._request("/moment/comment", body)

    def like(self, moment_id: str, moment_watch_id: str, emotion_id: int = 0) -> dict:
        """Like or unlike a moment (toggle)."""
        return self._request("/moment/like", {
            "emotionId": emotion_id,
            "momentId": moment_id,
            "momentWatchId": moment_watch_id,
            "watchId": self.config["watch_id"],
        })

    def post_moment(self, content: str, content_type: int = 3) -> dict:
        """Post a text moment (type=3)."""
        return self._request("/moment/public", {
            "content": content,
            "type": content_type,
            "watchId": self.config["watch_id"],
        })

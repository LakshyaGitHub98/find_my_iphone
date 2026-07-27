import json
import base64
import uuid
from pathlib import Path
from typing import Optional

from pyicloud import PyiCloudService
from pyicloud.exceptions import PyiCloudAPIResponseException, PyiCloudFailedLoginException

SESSION_FILE = Path.home() / ".findmy-session.json"
COOKIE_DIR = Path.home() / ".findmy-cookies"


class FindMyClient:
    def __init__(self):
        self.api: Optional[PyiCloudService] = None
        self.apple_id: Optional[str] = None
        self._load_session()

    # ── session persistence ──────────────────────────────────

    def _load_session(self) -> bool:
        if not SESSION_FILE.exists():
            return False
        try:
            data = json.loads(SESSION_FILE.read_text())
            password = base64.b64decode(data["password"]).decode()
            self.api = PyiCloudService(
                data["apple_id"],
                password,
                cookie_directory=str(COOKIE_DIR),
            )
            self.apple_id = data["apple_id"]
            return True
        except Exception:
            self.api = None
            SESSION_FILE.unlink(missing_ok=True)
            return False

    def _save_session(self, apple_id: str, password: str):
        data = {
            "apple_id": apple_id,
            "password": base64.b64encode(password.encode()).decode(),
        }
        SESSION_FILE.write_text(json.dumps(data, indent=2))

    def clear_session(self):
        self.api = None
        self.apple_id = None
        SESSION_FILE.unlink(missing_ok=True)

    def is_authenticated(self) -> bool:
        return self.api is not None

    # ── login / 2FA ──────────────────────────────────────────

    def _get_phone_numbers(self, api: PyiCloudService):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if api.session_data.get("scnt"):
            headers["scnt"] = api.session_data.get("scnt")
        if api.session_data.get("session_id"):
            headers["X-Apple-ID-Session-Id"] = api.session_data.get("session_id")
        req = api.session.get(
            f"{api.AUTH_ENDPOINT}/verify/phone",
            headers=headers,
        )
        return req.json().get("trustedPhoneNumbers", [])

    def _send_sms_code(self, api: PyiCloudService, phone_id: str):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if api.session_data.get("scnt"):
            headers["scnt"] = api.session_data.get("scnt")
        if api.session_data.get("session_id"):
            headers["X-Apple-ID-Session-Id"] = api.session_data.get("session_id")
        data = json.dumps({"phoneNumber": {"id": phone_id}, "mode": "sms"})
        api.session.put(
            f"{api.AUTH_ENDPOINT}/verify/phone",
            data=data,
            headers=headers,
        )

    def _validate_sms_code(self, api: PyiCloudService, phone_id: str, code: str) -> bool:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if api.session_data.get("scnt"):
            headers["scnt"] = api.session_data.get("scnt")
        if api.session_data.get("session_id"):
            headers["X-Apple-ID-Session-Id"] = api.session_data.get("session_id")
        data = json.dumps({
            "phoneNumber": {"id": phone_id},
            "securityCode": {"code": code},
            "mode": "sms",
        })
        try:
            api.session.post(
                f"{api.AUTH_ENDPOINT}/verify/phone/securitycode",
                data=data,
                headers=headers,
            )
            api.trust_session()
            return True
        except PyiCloudAPIResponseException:
            return False

    # ── 2FA state management ────────────────────────────────

    _pending_logins: dict = {}

    def start_login(self, apple_id: str, password: str) -> dict:
        try:
            api = PyiCloudService(
                apple_id, password,
                cookie_directory=str(COOKIE_DIR),
            )
        except PyiCloudFailedLoginException:
            return {"status": "error", "message": "Invalid email/password combination."}
        except PyiCloudAPIResponseException as e:
            return {"status": "error", "message": str(e) or "Apple server error."}

        if not api.requires_2fa and not api.requires_2sa:
            self.api = api
            self.apple_id = apple_id
            self._save_session(apple_id, password)
            return {"status": "ok"}

        token = uuid.uuid4().hex
        self._pending_logins[token] = {
            "api": api,
            "apple_id": apple_id,
            "password": password,
        }

        methods = []
        if api.requires_2sa:
            for i, dev in enumerate(api.trusted_devices):
                name = dev.get("deviceName", f"Device {i}")
                methods.append({
                    "type": "trusted_device",
                    "id": str(i),
                    "label": name,
                })
        else:
            try:
                phones = self._get_phone_numbers(api)
                for phone in phones:
                    methods.append({
                        "type": "phone",
                        "id": phone["id"],
                        "label": phone.get("numberWithDialCode", phone.get("obfuscatedNumber", "Phone")),
                    })
            except Exception:
                pass

        return {
            "status": "needs_2fa",
            "token": token,
            "methods": methods,
        }

    def send_2fa_code(self, token: str, method_id: str) -> dict:
        pending = self._pending_logins.get(token)
        if not pending:
            return {"error": "Invalid or expired login token"}
        api = pending["api"]

        if api.requires_2sa:
            try:
                idx = int(method_id)
                device = api.trusted_devices[idx]
                if api.send_verification_code(device):
                    return {"status": "sent"}
                return {"error": "Failed to send verification code"}
            except (ValueError, IndexError):
                return {"error": "Invalid device"}

        self._send_sms_code(api, method_id)
        return {"status": "sent"}

    def verify_2fa_code(self, token: str, method_id: str, code: str) -> dict:
        pending = self._pending_logins.get(token)
        if not pending:
            return {"error": "Invalid or expired login token"}
        api = pending["api"]

        if api.requires_2sa:
            try:
                idx = int(method_id)
                device = api.trusted_devices[idx]
                if api.validate_verification_code(device, code):
                    self.api = api
                    self.apple_id = pending["apple_id"]
                    self._save_session(pending["apple_id"], pending["password"])
                    self._pending_logins.pop(token, None)
                    return {"status": "ok"}
                return {"error": "Invalid verification code"}
            except (ValueError, IndexError):
                return {"error": "Invalid device"}

        if self._validate_sms_code(api, method_id, code):
            self.api = api
            self.apple_id = pending["apple_id"]
            self._save_session(pending["apple_id"], pending["password"])
            self._pending_logins.pop(token, None)
            return {"status": "ok"}
        return {"error": "Invalid verification code"}

    def verify_2fa_code_direct(self, token: str, code: str) -> dict:
        pending = self._pending_logins.get(token)
        if not pending:
            return {"error": "Invalid or expired login token"}
        api = pending["api"]

        if api.validate_2fa_code(code):
            if not api.is_trusted_session:
                api.trust_session()
            self.api = api
            self.apple_id = pending["apple_id"]
            self._save_session(pending["apple_id"], pending["password"])
            self._pending_logins.pop(token, None)
            return {"status": "ok"}
        return {"error": "Invalid verification code"}

    # ── devices ──────────────────────────────────────────────

    def get_devices(self) -> list:
        if not self.api:
            return []
        try:
            self.api.devices.refresh_client()
        except Exception:
            return []
        return list(self.api.devices)

    def find_device(self, query=None):
        devices = self.get_devices()
        if not devices:
            return None
        if not query:
            return devices[0]
        try:
            idx = int(query)
            if 0 <= idx < len(devices):
                return devices[idx]
        except ValueError:
            pass
        for d in devices:
            name = d.get("deviceDisplayName", "").lower()
            dev_name = d.get("name", "").lower()
            q = query.lower()
            if q in name or q in dev_name:
                return d
        return None

    def get_device_location(self, device) -> Optional[dict]:
        try:
            loc = device.location()
        except Exception:
            return None
        if not loc or not loc.get("latitude"):
            return None
        return {
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "timestamp": loc.get("timeStamp", 0),
            "horizontalAccuracy": loc.get("horizontalAccuracy"),
            "positionType": loc.get("positionType"),
            "isOld": loc.get("isOld", True),
        }

    def play_sound(self, device, message: str = "Find My iPhone Alert") -> bool:
        try:
            device.play_sound(subject=message)
            return True
        except Exception:
            return False

    def lost_mode(self, device, number: str, message: str, passcode: str = "") -> bool:
        try:
            device.lost_device(number=number, text=message, newpasscode=passcode)
            return True
        except Exception:
            return False

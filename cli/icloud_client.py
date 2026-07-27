import json
import base64
from pathlib import Path

from pyicloud import PyiCloudService
from pyicloud.exceptions import PyiCloudException, PyiCloudNoDevicesException, PyiCloudAPIResponseException

SESSION_FILE = Path.home() / ".findmy-session.json"


class FindMyClient:
    def __init__(self):
        self.api = None
        self.apple_id = None
        self._load_session()

    COOKIE_DIR = Path.home() / ".findmy-cookies"

    def _load_session(self):
        if not SESSION_FILE.exists():
            return False
        try:
            data = json.loads(SESSION_FILE.read_text())
            password = base64.b64decode(data["password"]).decode()
            self.api = PyiCloudService(
                data["apple_id"],
                password,
                cookie_directory=str(self.COOKIE_DIR),
            )
            self.apple_id = data["apple_id"]
            return True
        except Exception:
            self.api = None
            SESSION_FILE.unlink(missing_ok=True)
            return False

    def _save_session(self, apple_id, password):
        data = {
            "apple_id": apple_id,
            "password": base64.b64encode(password.encode()).decode(),
        }
        SESSION_FILE.write_text(json.dumps(data, indent=2))

    def _get_phone_numbers(self):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api.session_data.get("scnt"):
            headers["scnt"] = self.api.session_data.get("scnt")
        if self.api.session_data.get("session_id"):
            headers["X-Apple-ID-Session-Id"] = self.api.session_data.get("session_id")
        req = self.api.session.get(
            f"{self.api.AUTH_ENDPOINT}/verify/phone",
            headers=headers,
        )
        return req.json().get("trustedPhoneNumbers", [])

    def _send_sms_code(self, phone_id):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api.session_data.get("scnt"):
            headers["scnt"] = self.api.session_data.get("scnt")
        if self.api.session_data.get("session_id"):
            headers["X-Apple-ID-Session-Id"] = self.api.session_data.get("session_id")
        data = json.dumps({"phoneNumber": {"id": phone_id}, "mode": "sms"})
        self.api.session.put(
            f"{self.api.AUTH_ENDPOINT}/verify/phone",
            data=data,
            headers=headers,
        )

    def _validate_sms_code(self, phone_id, code):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api.session_data.get("scnt"):
            headers["scnt"] = self.api.session_data.get("scnt")
        if self.api.session_data.get("session_id"):
            headers["X-Apple-ID-Session-Id"] = self.api.session_data.get("session_id")
        data = json.dumps({
            "phoneNumber": {"id": phone_id},
            "securityCode": {"code": code},
            "mode": "sms",
        })
        try:
            self.api.session.post(
                f"{self.api.AUTH_ENDPOINT}/verify/phone/securitycode",
                data=data,
                headers=headers,
            )
            self.api.trust_session()
            return True
        except PyiCloudAPIResponseException:
            return False

    def _handle_2fa(self):
        if not self.api.requires_2fa:
            return True

        if self.api.requires_2sa:
            devices = self.api.trusted_devices
            print("\nTwo-step authentication required.")
            print("Trusted devices:")
            for i, device in enumerate(devices):
                name = device.get("deviceName", f"SMS to {device.get('phoneNumber', 'unknown')}")
                print(f"  {i}: {name}")

            choice = input("\nWhich device (number)? ").strip()
            try:
                idx = int(choice)
                device = devices[idx]
            except (ValueError, IndexError):
                print("Invalid choice")
                return False

            if not self.api.send_verification_code(device):
                print("Failed to send verification code")
                return False

            code = input("Enter verification code: ").strip()
            if not self.api.validate_verification_code(device, code):
                print("Invalid verification code")
                return False
        else:
            print("\nTwo-factor authentication required.")
            print("A verification code was sent to your Apple devices.")

            phones = []
            try:
                phones = self._get_phone_numbers()
            except Exception:
                pass

            if phones:
                for i, phone in enumerate(phones):
                    num = phone.get("numberWithDialCode", phone.get("obfuscatedNumber", f"phone {i}"))
                    print(f"  [{i}] Send SMS to {num}")
                print("  [Enter] Enter code from your device")

                choice = input("\nChoice: ").strip()

                if choice:
                    try:
                        idx = int(choice)
                        if 0 <= idx < len(phones):
                            phone = phones[idx]
                            self._send_sms_code(phone["id"])
                            print("SMS sent! Check your phone for the code.")
                            code = input("Enter the 6-digit SMS code: ").strip()
                            if self._validate_sms_code(phone["id"], code):
                                return True
                            print("Invalid SMS code")
                            return False
                    except (ValueError, IndexError, KeyError):
                        pass
                    code = choice
                else:
                    code = input("Enter the 6-digit code: ").strip()
            else:
                code = input("Enter the 6-digit code: ").strip()

            if not self.api.validate_2fa_code(code):
                print("Invalid verification code")
                return False
            if not self.api.is_trusted_session:
                print("Trusting this session...")
                self.api.trust_session()

        return True

    def login(self, apple_id, password):
        self.api = PyiCloudService(apple_id, password)
        self.apple_id = apple_id

        if self.api.requires_2fa:
            if not self._handle_2fa():
                return False

        self._save_session(apple_id, password)
        return True

    def is_authenticated(self):
        return self.api is not None

    def get_devices(self):
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
        results = []
        for d in devices:
            name = d.get("deviceDisplayName", "").lower()
            dev_name = d.get("name", "").lower()
            q = query.lower()
            if q in name or q in dev_name:
                results.append(d)
        if len(results) == 1:
            return results[0]
        if len(results) > 1:
            print(f"Multiple devices match '{query}':")
            for i, d in enumerate(results):
                print(f"  {i}: {d['deviceDisplayName']}")
            try:
                idx = int(input("Which one (number)? ").strip())
                return results[idx]
            except (ValueError, IndexError):
                return results[0]
        return devices[0]

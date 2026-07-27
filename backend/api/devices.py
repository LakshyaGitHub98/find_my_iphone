from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from client import client

router = APIRouter(prefix="/api/devices", tags=["devices"])


def require_auth():
    if not client.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated")


def serialize_device(d) -> dict:
    battery = d.get("batteryLevel", 0)
    status_code = d.get("deviceStatus", "")
    return {
        "id": str(d.get("id", "")),
        "name": d.get("deviceDisplayName", "Unknown"),
        "model": d.get("deviceModel", ""),
        "deviceClass": d.get("deviceClass", ""),
        "batteryLevel": battery,
        "batteryPercent": f"{battery * 100:.0f}%" if battery else None,
        "isOnline": status_code == "200",
        "deviceStatus": status_code,
        "activationLocked": d.get("activationLocked", False),
        "isLocating": d.get("isLocating", False),
    }


class SoundRequest(BaseModel):
    message: str = "Find My iPhone Alert"


class LostModeRequest(BaseModel):
    number: str
    message: str = "This iPhone has been lost. Please call me."
    passcode: str = ""


@router.get("")
def list_devices():
    require_auth()
    devices = client.get_devices()
    return [serialize_device(d) for d in devices]


@router.get("/{device_id}")
def get_device(device_id: str):
    require_auth()
    dev = client.find_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    result = serialize_device(dev)
    result["status"] = dev.status()
    return result


@router.get("/{device_id}/location")
def get_location(device_id: str):
    require_auth()
    dev = client.find_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    loc = client.get_device_location(dev)
    if not loc:
        raise HTTPException(status_code=404, detail="No location data available")
    return loc


@router.post("/{device_id}/sound")
def play_sound(device_id: str, req: SoundRequest):
    require_auth()
    dev = client.find_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    if client.play_sound(dev, req.message):
        return {"status": "ok", "message": f"Sound alert sent to {dev['deviceDisplayName']}"}
    raise HTTPException(status_code=500, detail="Failed to play sound")


@router.post("/{device_id}/lost")
def enable_lost_mode(device_id: str, req: LostModeRequest):
    require_auth()
    dev = client.find_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    if client.lost_mode(dev, req.number, req.message, req.passcode):
        return {"status": "ok", "message": f"Lost Mode enabled on {dev['deviceDisplayName']}"}
    raise HTTPException(status_code=500, detail="Failed to enable Lost Mode")

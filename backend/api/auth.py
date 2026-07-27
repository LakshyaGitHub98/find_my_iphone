from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from client import client

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    apple_id: str
    password: str


class TwoFactorSendRequest(BaseModel):
    token: str
    method_id: str


class TwoFactorVerifyRequest(BaseModel):
    token: str
    method_id: str
    code: str


class TwoFactorVerifyDirectRequest(BaseModel):
    token: str
    code: str


@router.post("/login")
def login(req: LoginRequest):
    if not req.apple_id or not req.password:
        raise HTTPException(status_code=400, detail="Apple ID and password are required.")
    result = client.start_login(req.apple_id, req.password)
    if result.get("status") == "ok":
        return {"status": "ok"}
    if result.get("status") == "needs_2fa":
        return {
            "status": "needs_2fa",
            "token": result["token"],
            "methods": result.get("methods", []),
        }
    raise HTTPException(
        status_code=401,
        detail=result.get("message", "Authentication failed"),
    )


@router.post("/2fa/send")
def send_2fa(req: TwoFactorSendRequest):
    result = client.send_2fa_code(req.token, req.method_id)
    if result.get("status") == "sent":
        return {"status": "sent"}
    raise HTTPException(status_code=400, detail=result.get("error", "Failed to send code"))


@router.post("/2fa/verify")
def verify_2fa(req: TwoFactorVerifyRequest):
    result = client.verify_2fa_code(req.token, req.method_id, req.code)
    if result.get("status") == "ok":
        return {"status": "ok"}
    raise HTTPException(status_code=400, detail=result.get("error", "Invalid verification code"))


@router.post("/2fa/verify-direct")
def verify_2fa_direct(req: TwoFactorVerifyDirectRequest):
    result = client.verify_2fa_code_direct(req.token, req.code)
    if result.get("status") == "ok":
        return {"status": "ok"}
    raise HTTPException(status_code=400, detail=result.get("error", "Invalid verification code"))


@router.get("/session")
def check_session():
    return {"authenticated": client.is_authenticated()}


@router.post("/logout")
def logout():
    client.clear_session()
    return {"status": "ok"}

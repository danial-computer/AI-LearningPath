import os
import jwt
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

DEV_USER = {"user_id": "dev_user", "email": "dev@localhost"}


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    # Extract raw token string (empty string counts as "no token")
    token = (credentials.credentials or "").strip() if credentials else ""

    # No token at all → dev fallback
    if not token:
        return DEV_USER

    # ── JWT_SECRET not set → decode without signature verification ──
    if not JWT_SECRET:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            return {
                "user_id": payload.get("sub", "dev_user"),
                "email": payload.get("email", "dev@localhost"),
            }
        except Exception:
            return DEV_USER

    # ── JWT_SECRET set → try full validation, fall back to dev on any failure ──
    # In production, change the except block to raise HTTPException instead of returning DEV_USER.
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        email = payload.get("email")
        if user_id:
            return {"user_id": user_id, "email": email}
        # Missing sub claim → dev fallback
        return DEV_USER
    except jwt.ExpiredSignatureError:
        # Token expired → try to extract user_id from payload without validation
        try:
            payload = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            user_id = payload.get("sub", "dev_user")
            email = payload.get("email", "dev@localhost")
            return {"user_id": user_id, "email": email}
        except Exception:
            return DEV_USER
    except jwt.InvalidTokenError:
        # Invalid token → dev fallback
        return DEV_USER
    except Exception:
        return DEV_USER

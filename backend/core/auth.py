import os
import jwt
import base64
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

# Keep track of initialized JWKS client
jwks_client = None

def get_jwks_client():
    global jwks_client
    if jwks_client is not None:
        return jwks_client
        
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        return None
        
    # Clean the URL (remove quotes and trailing slash)
    supabase_url = supabase_url.strip().strip('"').strip("'").rstrip('/')
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    
    try:
        from jwt import PyJWKClient
        jwks_client = PyJWKClient(jwks_url)
        print(f"[Auth Init] JWKS Client initialized successfully with URL: {jwks_url}")
        return jwks_client
    except Exception as e:
        print(f"[Auth Warning] Failed to initialize PyJWKClient: {e}. Fallback to secret key validation.")
        return None

DEV_USER = {"user_id": "dev_user", "email": "dev@localhost"}


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    if not credentials:
        print("[Auth Error] Credentials missing in request headers")
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials were not provided"
        )
    
    token = credentials.credentials
    payload = None
    errors = []
    
    # Retrieve environment variables dynamically at runtime
    supabase_url = os.getenv("SUPABASE_URL")
    jwt_secret_raw = os.getenv("SUPABASE_JWT_SECRET")
    
    # Clean variables if they exist
    if supabase_url:
        supabase_url = supabase_url.strip().strip('"').strip("'").rstrip('/')
    if jwt_secret_raw:
        jwt_secret_raw = jwt_secret_raw.strip().strip('"').strip("'")
        
    try:
        # Log unverified header to inspect alg/typ/kid
        try:
            unverified_header = jwt.get_unverified_header(token)
            print(f"[Auth Info] Token header: {unverified_header}")
        except Exception as eh:
            print(f"[Auth Warning] Failed to get unverified header: {eh}")
            unverified_header = {}
            
        # METODE 1: Verifikasi menggunakan JWKS (Wajib untuk kunci asimetris seperti ES256/RS256)
        client = get_jwks_client()
        if client:
            try:
                # This fetches the keys from the JWKS endpoint (uses caching internally)
                signing_key = client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["ES256", "RS256", "HS256"],
                    audience="authenticated"
                )
                print("[Auth Success] Verified token using Supabase JWKS (ES256/RS256).")
            except Exception as e_jwks:
                errors.append(f"JWKS verification failed: {e_jwks}")
        else:
            errors.append("JWKS client is not initialized (SUPABASE_URL might be missing).")

        # METODE 2: Coba dengan kunci Plain-Text asli (Fallback jika JWKS offline / untuk HS256)
        if not payload and jwt_secret_raw:
            try:
                payload = jwt.decode(
                    token, 
                    jwt_secret_raw, 
                    algorithms=["HS256"], 
                    audience="authenticated"
                )
                print("[Auth Success] Verified token using plain-text JWT_SECRET (HS256).")
            except Exception as e_raw:
                errors.append(f"Plain-text HS256 failed: {e_raw}")
                
        # METODE 3: Coba dengan kunci Base64-Decoded
        if not payload and jwt_secret_raw:
            try:
                padding = len(jwt_secret_raw) % 4
                padded = jwt_secret_raw + ("=" * (4 - padding) if padding else "")
                decoded_secret = base64.b64decode(padded)
                payload = jwt.decode(
                    token, 
                    decoded_secret, 
                    algorithms=["HS256"], 
                    audience="authenticated"
                )
                print("[Auth Success] Verified token using base64-decoded JWT_SECRET (HS256).")
            except Exception as e_b64:
                errors.append(f"Base64 HS256 failed: {e_b64}")

        # METODE 4: Fallback tanpa spesifikasi algoritma (Untuk kompatibilitas python-jose)
        if not payload and jwt_secret_raw:
            try:
                # Note: In PyJWT 2.0+, this will fail if algorithms is not provided, 
                # but we keep it here as a legacy fallback and log the exception.
                payload = jwt.decode(
                    token, 
                    jwt_secret_raw, 
                    audience="authenticated"
                )
                print("[Auth Success] Verified token using fallback.")
            except Exception as e_fallback:
                errors.append(f"Fallback without alg failed: {e_fallback}")
                
        # Jika semua metode gagal
        if not payload:
            print(f"[Auth Error] All token verification methods failed: {errors}")
            raise jwt.InvalidTokenError("All token verification methods failed")
            
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id:
            print("[Auth Error] Token payload missing 'sub' claim")
            raise HTTPException(status_code=401, detail="Invalid token payload: missing 'sub' claim")
            
        return {"user_id": user_id, "email": email}
        
    except jwt.ExpiredSignatureError as e:
        print(f"[Auth Error] Token has expired: {e}")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        print(f"[Auth Error] Invalid token validation failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

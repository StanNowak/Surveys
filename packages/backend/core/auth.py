"""
Auth0 Middleware Module
Dev-mode: Simple token validation (no external Auth0 setup required)
Production: Can be switched to real Auth0 with environment variables
"""

import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional


security = HTTPBearer()


async def verify_auth0_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Optional[dict]:
    """
    Verify Auth0 Bearer token.
    
    DEV MODE (default): Accepts any token, returns mock user
    PRODUCTION MODE: Set AUTH0_DOMAIN env var to enable real Auth0 verification
    
    Args:
        credentials: HTTP Bearer credentials from request header
    
    Returns:
        Decoded token payload (dict) with user info
    
    Raises:
        HTTPException: If token is invalid (in production mode)
    """
    token = credentials.credentials
    auth0_domain = os.getenv("AUTH0_DOMAIN")
    
    # DEV MODE: No Auth0 setup required - just accept any token
    if not auth0_domain:
        # Mock user for development
        return {
            "sub": f"dev_user_{token[:8]}",  # Use first 8 chars of token as ID
            "email": "dev@example.com",
            "name": "Development User",
            "dev_mode": True
        }
    
    # PRODUCTION MODE: Real Auth0 verification
    # TODO: Implement actual Auth0 JWT verification when ready
    # from jose import jwt, JWTError
    # try:
    #     jwks_url = f"https://{auth0_domain}/.well-known/jwks.json"
    #     # Fetch JWKS and verify token...
    #     payload = jwt.decode(token, ...)
    #     return payload
    # except JWTError:
    #     raise HTTPException(status_code=401, detail="Invalid token")
    
    # For now, if AUTH0_DOMAIN is set but not implemented, reject
    raise HTTPException(
        status_code=501,
        detail="Auth0 verification not yet implemented. Set AUTH0_DOMAIN only when ready."
    )


async def optional_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(
        HTTPBearer(auto_error=False)
    )
) -> Optional[dict]:
    """
    Optional Auth0 token verification (for endpoints that work with or without auth).
    
    Returns:
        Token payload if present, None otherwise
    """
    if credentials is None:
        return None
    
    return await verify_auth0_token(credentials)


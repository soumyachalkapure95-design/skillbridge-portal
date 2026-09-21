from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import List, Callable
from sqlmodel import Session, select
from app.database import engine
from app.models import User
import os

SECRET_KEY = os.getenv("SECRET_KEY", "skillbridge-secret-key-sih2026-secure-auth-matrix")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=True)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> User:
    """
    Read Bearer JWT token, validate it, and return the authenticated User from DB.
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.email == email.lower())
        ).first()

        if user is None or not user.is_active:
            raise credentials_exception

        return user

def require_roles(allowed_roles: List[str]) -> Callable:
    """
    Dependency factory to enforce Role-Based Access Control (RBAC).
    Usage: Depends(require_roles(["admin", "industry"]))
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (current_user.role or "student").lower()
        normalized_allowed = [r.lower() for r in allowed_roles]
        
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Your account role is '{user_role.title()}', but this operation requires {', '.join([r.title() for r in allowed_roles])} privileges."
            )
        return current_user
    return role_checker

# Predefined role dependencies
get_current_student = require_roles(["student", "admin"])
get_current_industry = require_roles(["industry", "admin"])
get_current_academia = require_roles(["academia", "admin"])
get_current_admin = require_roles(["admin"])
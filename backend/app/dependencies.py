from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.supabase import get_supabase_client, get_supabase_admin_client

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """현재 인증된 사용자 정보 반환"""

    token = credentials.credentials
    supabase = get_supabase_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
        return user_response.user
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def _get_user_role(user_id: str) -> str:
    """사용자의 역할을 조회"""
    supabase = get_supabase_admin_client()

    result = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    return result.data.get("role", "student")


async def get_current_admin_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """관리자 권한 확인"""

    role = await _get_user_role(str(current_user.id))

    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


async def get_current_teacher_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """교사 권한 확인 (admin도 허용)"""

    role = await _get_user_role(str(current_user.id))

    if role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required",
        )

    return current_user

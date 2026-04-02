from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.services.supabase import get_supabase_admin_client
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse
from app.schemas.common import MessageResponse

router = APIRouter()


@router.get("/videos/{video_id}/comments", response_model=List[CommentResponse])
async def get_video_comments(
    video_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """비디오 댓글 목록 조회 (수강생/교사/관리자)"""
    supabase = get_supabase_admin_client()

    # 비디오 존재 확인
    video = (
        supabase.table("videos")
        .select("course_id")
        .eq("id", str(video_id))
        .single()
        .execute()
    )

    if not video.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # 접근 권한 확인: 수강생, 교사(강의 소유자), 관리자
    profile = (
        supabase.table("profiles")
        .select("role")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )

    role = profile.data.get("role", "student") if profile.data else "student"

    if role == "student":
        # 수강 등록 확인
        enrollment = (
            supabase.table("enrollments")
            .select("id")
            .eq("user_id", str(current_user.id))
            .eq("course_id", video.data["course_id"])
            .execute()
        )

        if not enrollment.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 강의에 대한 수강 권한이 없습니다",
            )

    # 댓글 조회 (작성자 이름 포함)
    comments = (
        supabase.table("comments")
        .select("*, profiles(name)")
        .eq("video_id", str(video_id))
        .order("created_at", desc=False)
        .execute()
    )

    result = []
    for comment in comments.data or []:
        user_name = None
        if comment.get("profiles"):
            user_name = comment["profiles"].get("name")
        result.append({
            "id": comment["id"],
            "video_id": comment["video_id"],
            "user_id": comment["user_id"],
            "content": comment["content"],
            "created_at": comment["created_at"],
            "updated_at": comment["updated_at"],
            "user_name": user_name,
        })

    return result


@router.post("/comments", response_model=CommentResponse)
async def create_comment(
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user),
):
    """댓글 작성 (수강생)"""
    supabase = get_supabase_admin_client()

    # 비디오 존재 확인
    video = (
        supabase.table("videos")
        .select("course_id")
        .eq("id", str(comment_data.video_id))
        .single()
        .execute()
    )

    if not video.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # 수강 등록 확인
    enrollment = (
        supabase.table("enrollments")
        .select("id")
        .eq("user_id", str(current_user.id))
        .eq("course_id", video.data["course_id"])
        .execute()
    )

    if not enrollment.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 강의에 수강 등록이 필요합니다",
        )

    result = (
        supabase.table("comments")
        .insert({
            "video_id": str(comment_data.video_id),
            "user_id": str(current_user.id),
            "content": comment_data.content,
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create comment",
        )

    # 작성자 이름 조회
    profile = (
        supabase.table("profiles")
        .select("name")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )

    comment = result.data[0]
    comment["user_name"] = profile.data.get("name") if profile.data else None

    return comment


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: UUID,
    comment_data: CommentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """댓글 수정 (본인 댓글만)"""
    supabase = get_supabase_admin_client()

    # 댓글 존재 및 소유권 확인
    existing = (
        supabase.table("comments")
        .select("*")
        .eq("id", str(comment_id))
        .single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    if existing.data["user_id"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own comments",
        )

    result = (
        supabase.table("comments")
        .update({"content": comment_data.content})
        .eq("id", str(comment_id))
        .execute()
    )

    comment = result.data[0]

    # 작성자 이름 조회
    profile = (
        supabase.table("profiles")
        .select("name")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )
    comment["user_name"] = profile.data.get("name") if profile.data else None

    return comment


@router.delete("/comments/{comment_id}", response_model=MessageResponse)
async def delete_comment(
    comment_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """댓글 삭제 (본인 댓글 또는 교사/관리자)"""
    supabase = get_supabase_admin_client()

    # 댓글 존재 확인
    existing = (
        supabase.table("comments")
        .select("*")
        .eq("id", str(comment_id))
        .single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # 권한 확인: 본인 댓글이 아니면 교사/관리자여야 함
    if existing.data["user_id"] != str(current_user.id):
        profile = (
            supabase.table("profiles")
            .select("role")
            .eq("id", str(current_user.id))
            .single()
            .execute()
        )

        role = profile.data.get("role", "student") if profile.data else "student"

        if role not in ("teacher", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own comments",
            )

    supabase.table("comments").delete().eq("id", str(comment_id)).execute()

    return {"message": "Comment deleted successfully"}

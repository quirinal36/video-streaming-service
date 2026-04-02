from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_teacher_user
from app.services.supabase import get_supabase_admin_client
from app.services.bunny import bunny_service
from app.schemas.course import CourseCreate, CourseUpdate, CourseResponse
from app.schemas.video import VideoCreate, VideoUpdate, VideoResponse
from app.schemas.common import MessageResponse

router = APIRouter()


# ============== Helper ==============


async def _verify_course_ownership(course_id: str, user_id: str) -> dict:
    """강의 소유권 확인 (admin은 모든 강의 접근 가능)"""
    supabase = get_supabase_admin_client()

    course = (
        supabase.table("courses")
        .select("*")
        .eq("id", course_id)
        .single()
        .execute()
    )

    if not course.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    # admin 여부 확인
    profile = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user_id)
        .single()
        .execute()
    )

    is_admin = profile.data and profile.data.get("role") == "admin"

    if not is_admin and course.data.get("teacher_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage this course",
        )

    return course.data


# ============== Course Management ==============


@router.get("/courses", response_model=List[CourseResponse])
async def teacher_get_courses(current_user: dict = Depends(get_current_teacher_user)):
    """내 강의 목록 조회 (교사)"""
    supabase = get_supabase_admin_client()

    # admin은 모든 강의, teacher는 자기 강의만
    profile = (
        supabase.table("profiles")
        .select("role")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )

    if profile.data and profile.data.get("role") == "admin":
        courses = supabase.table("courses").select("*").execute()
    else:
        courses = (
            supabase.table("courses")
            .select("*")
            .eq("teacher_id", str(current_user.id))
            .execute()
        )

    return courses.data or []


@router.post("/courses", response_model=CourseResponse)
async def teacher_create_course(
    course_data: CourseCreate,
    current_user: dict = Depends(get_current_teacher_user),
):
    """강의 생성 (교사 - 자동으로 본인이 소유자)"""
    supabase = get_supabase_admin_client()

    data = course_data.model_dump()
    data["teacher_id"] = str(current_user.id)

    result = supabase.table("courses").insert(data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create course",
        )

    return result.data[0]


@router.put("/courses/{course_id}", response_model=CourseResponse)
async def teacher_update_course(
    course_id: UUID,
    course_data: CourseUpdate,
    current_user: dict = Depends(get_current_teacher_user),
):
    """강의 수정 (교사 - 본인 강의만)"""
    supabase = get_supabase_admin_client()

    await _verify_course_ownership(str(course_id), str(current_user.id))

    update_data = {k: v for k, v in course_data.model_dump().items() if v is not None}

    result = (
        supabase.table("courses")
        .update(update_data)
        .eq("id", str(course_id))
        .execute()
    )

    return result.data[0]


@router.delete("/courses/{course_id}", response_model=MessageResponse)
async def teacher_delete_course(
    course_id: UUID,
    current_user: dict = Depends(get_current_teacher_user),
):
    """강의 삭제 (교사 - 본인 강의만)"""
    supabase = get_supabase_admin_client()

    await _verify_course_ownership(str(course_id), str(current_user.id))

    supabase.table("videos").delete().eq("course_id", str(course_id)).execute()
    supabase.table("enrollments").delete().eq("course_id", str(course_id)).execute()
    supabase.table("courses").delete().eq("id", str(course_id)).execute()

    return {"message": "Course deleted successfully"}


# ============== Video Management ==============


@router.get("/courses/{course_id}/videos", response_model=List[VideoResponse])
async def teacher_get_course_videos(
    course_id: UUID,
    current_user: dict = Depends(get_current_teacher_user),
):
    """강의 내 비디오 목록 조회 (교사)"""
    supabase = get_supabase_admin_client()

    await _verify_course_ownership(str(course_id), str(current_user.id))

    videos = (
        supabase.table("videos")
        .select("*")
        .eq("course_id", str(course_id))
        .order("order_index")
        .execute()
    )

    return videos.data or []


@router.post("/videos", response_model=VideoResponse)
async def teacher_create_video(
    video_data: VideoCreate,
    current_user: dict = Depends(get_current_teacher_user),
):
    """비디오 등록 (교사 - 본인 강의에만)"""
    supabase = get_supabase_admin_client()

    await _verify_course_ownership(str(video_data.course_id), str(current_user.id))

    data = video_data.model_dump()
    data["course_id"] = str(data["course_id"])

    result = supabase.table("videos").insert(data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create video",
        )

    return result.data[0]


@router.put("/videos/{video_id}", response_model=VideoResponse)
async def teacher_update_video(
    video_id: UUID,
    video_data: VideoUpdate,
    current_user: dict = Depends(get_current_teacher_user),
):
    """비디오 수정 (교사 - 본인 강의의 비디오만)"""
    supabase = get_supabase_admin_client()

    # 비디오 조회
    video = (
        supabase.table("videos")
        .select("*")
        .eq("id", str(video_id))
        .single()
        .execute()
    )

    if not video.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    await _verify_course_ownership(video.data["course_id"], str(current_user.id))

    update_data = {k: v for k, v in video_data.model_dump().items() if v is not None}

    result = (
        supabase.table("videos")
        .update(update_data)
        .eq("id", str(video_id))
        .execute()
    )

    return result.data[0]


@router.delete("/videos/{video_id}", response_model=MessageResponse)
async def teacher_delete_video(
    video_id: UUID,
    current_user: dict = Depends(get_current_teacher_user),
):
    """비디오 삭제 (교사 - 본인 강의의 비디오만)"""
    supabase = get_supabase_admin_client()

    video = (
        supabase.table("videos")
        .select("bunny_video_id, course_id")
        .eq("id", str(video_id))
        .single()
        .execute()
    )

    if not video.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    await _verify_course_ownership(video.data["course_id"], str(current_user.id))

    # Bunny에서 비디오 삭제
    if video.data.get("bunny_video_id"):
        try:
            await bunny_service.delete_video(video.data["bunny_video_id"])
        except Exception:
            pass

    supabase.table("watch_history").delete().eq("video_id", str(video_id)).execute()
    supabase.table("videos").delete().eq("id", str(video_id)).execute()

    return {"message": "Video deleted successfully"}


# ============== Video Upload ==============


@router.post("/videos/upload-url")
async def teacher_get_upload_url(
    course_id: UUID,
    title: str,
    current_user: dict = Depends(get_current_teacher_user),
):
    """Bunny Stream Upload URL 발급 (교사)"""
    await _verify_course_ownership(str(course_id), str(current_user.id))

    result = await bunny_service.create_video(title=title)
    video_guid = result["guid"]
    upload_url = bunny_service.get_upload_url(video_guid)

    return {
        "upload_url": upload_url,
        "bunny_video_id": video_guid,
        "course_id": str(course_id),
        "title": title,
        "upload_headers": {"AccessKey": bunny_service.api_key},
    }


@router.post("/videos/complete-upload")
async def teacher_complete_upload(
    bunny_video_id: str,
    course_id: UUID,
    title: str,
    description: str = None,
    duration_seconds: int = 0,
    order_index: int = 0,
    current_user: dict = Depends(get_current_teacher_user),
):
    """업로드 완료 후 비디오 정보 저장 (교사)"""
    supabase = get_supabase_admin_client()

    await _verify_course_ownership(str(course_id), str(current_user.id))

    try:
        bunny_video = await bunny_service.get_video_details(bunny_video_id)
        duration_seconds = int(bunny_video.get("length", duration_seconds))
        thumbnail = bunny_service.get_thumbnail_url(bunny_video_id)
    except Exception:
        thumbnail = bunny_service.get_thumbnail_url(bunny_video_id)

    video_data = {
        "course_id": str(course_id),
        "title": title,
        "description": description,
        "bunny_video_id": bunny_video_id,
        "duration_seconds": duration_seconds,
        "order_index": order_index,
        "bunny_thumbnail": thumbnail,
    }

    result = supabase.table("videos").insert(video_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to save video info",
        )

    return result.data[0]


@router.get("/videos/{video_id}/status")
async def teacher_get_video_status(
    video_id: str,
    current_user: dict = Depends(get_current_teacher_user),
):
    """Bunny 비디오 처리 상태 조회 (교사)"""
    try:
        video_details = await bunny_service.get_video_details(video_id)
        bunny_status = video_details.get("status", 0)
        status_map = {
            0: "created", 1: "uploaded", 2: "processing",
            3: "transcoding", 4: "finished", 5: "error",
        }
        return {
            "video_id": video_id,
            "status": status_map.get(bunny_status, "unknown"),
            "ready_to_stream": bunny_status == 4,
            "duration": video_details.get("length"),
            "thumbnail": bunny_service.get_thumbnail_url(video_id),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video not found: {str(e)}",
        )

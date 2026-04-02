from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel


class CommentCreate(BaseModel):
    video_id: UUID
    content: str


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: UUID
    video_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None

    class Config:
        from_attributes = True

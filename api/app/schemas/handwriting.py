"""손글씨 입력 응답 형식."""

from pydantic import BaseModel


class HandwritingResponse(BaseModel):
    text: str

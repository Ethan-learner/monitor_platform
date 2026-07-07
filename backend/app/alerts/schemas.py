from typing import Any

from pydantic import BaseModel


class AlertError(BaseModel):
    detail: str

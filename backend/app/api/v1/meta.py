from fastapi import APIRouter, Request
from pydantic import BaseModel

from app import __version__
from app.core.config import Environment, Settings

router = APIRouter(tags=["meta"])


class MetaResponse(BaseModel):
    name: str
    version: str
    environment: Environment


@router.get("/meta", summary="Service information")
async def meta(request: Request) -> MetaResponse:
    settings: Settings = request.app.state.settings
    return MetaResponse(name="virello-api", version=__version__, environment=settings.environment)

from fastapi import APIRouter, Request, Response

from app.api.auth_deps import CsrfProtectedAuth, CurrentAuth
from app.api.deps import get_settings_from
from app.api.session_deps import AuthServiceDep
from app.auth.cookies import clear_cookie, session_cookie_name
from app.core.errors import ErrorResponse
from app.schemas.auth import UserResponse

router = APIRouter(
    prefix="/me",
    tags=["me"],
    responses={
        401: {"model": ErrorResponse, "description": "Not signed in."},
        403: {"model": ErrorResponse, "description": "The request failed CSRF verification."},
    },
)


@router.get("", summary="The signed-in user")
async def get_me(context: CurrentAuth) -> UserResponse:
    return UserResponse.from_domain(context.user)


@router.delete("", summary="Delete my account and everything stored for it", status_code=204)
async def delete_me(
    request: Request, response: Response, context: CsrfProtectedAuth, service: AuthServiceDep
) -> None:
    await service.delete_account(context.user.id)  # sessions and linked identities cascade
    settings = get_settings_from(request)
    clear_cookie(response, settings, session_cookie_name(settings))

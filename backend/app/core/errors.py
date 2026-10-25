"""Stable error shapes and exception handlers.

Clients get a consistent body and never see stack traces.
"""

import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("vulnix.errors")


class AppError(Exception):
    """Domain error mapped directly to an HTTP response."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def error_body(code: str, message: str, request_id: str, details: list[Any] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "request_id": request_id, "details": details or []}}


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "") or uuid.uuid4().hex


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, get_request_id(request), exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Strip untrusted input echoes from messages; keep field paths only.
        details = [{"field": ".".join(str(p) for p in e.get("loc", []))} for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content=error_body(
                "VALIDATION_ERROR", "The request could not be validated.", get_request_id(request), details
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Log server-side with traceback; return a generic body.
        logger.exception("unhandled_error request_id=%s", get_request_id(request))
        return JSONResponse(
            status_code=500,
            content=error_body("INTERNAL_ERROR", "An unexpected error occurred.", get_request_id(request)),
        )

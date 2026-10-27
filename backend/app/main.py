"""FastAPI application entry point."""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.db.session import check_db_connection

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("vulnix.startup")


def _check_redis_connection() -> tuple[bool, str | None]:
    try:
        import redis

        client = redis.Redis.from_url(settings.celery_broker_url, socket_connect_timeout=2)
        client.ping()
        return True, None
    except Exception as exc:  # pragma: no cover - covered via startup logging
        return False, str(exc)


def _format_swarm_table(swarm: dict) -> str:
    col_w = [18, 21, 44, 14]
    tot = sum(col_w) + 3
    sep_line = "+" + "-" * tot + "+"
    sep_mid = "+" + "+".join("-" * w for w in col_w) + "+"
    banner = "|" + " VULNIX AGENTIC AUDIT ARCHITECTURE - SPECIALIST SWARM ".center(tot) + "|"

    def fmt_row(c0: str, c1: str, c2: str, c3: str) -> str:
        return (
            f"| {c0:<{col_w[0]-2}} | {c1:<{col_w[1]-2}} | {c2:<{col_w[2]-2}} | {c3:<{col_w[3]-2}} |"
        )

    router_state = (
        f"ACTIVE (x{swarm.get('max_workers', 6)})"
        if swarm.get("router") == "enabled"
        else "DISABLED"
    )
    agents = swarm.get("agents", {})
    code_st = agents.get("code", {}).get("status", "ready").upper()
    intel_st = agents.get("intel", {}).get("status", "ready").upper()
    dep_st = agents.get("dep", {}).get("status", "ready").upper()

    rows = [
        ("AgentRouter", "Dynamic Router", "Severity-based specialist fan-out & merge", router_state),
        ("CodeAgent", "Multi-Turn SAST", "Code investigation & verified patch diffs", code_st),
        ("IntelAgent", "Live Threat Feeds", "Real-time CVE, EPSS & OSV intelligence", intel_st),
        ("DepAgent", "SCA Analyzer", "Dependency tree, safe upgrades & license", dep_st),
    ]

    lines = [
        "",
        sep_line,
        banner,
        sep_mid,
        fmt_row("AGENT / LAYER", "ENGINE / MODE", "SPECIALTY & RESPONSIBILITIES", "STATUS"),
        sep_mid,
    ]
    for r in rows:
        lines.append(fmt_row(*r))
    lines.append(sep_mid)

    return "\n".join(lines)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_ok, db_error = check_db_connection()
    if db_ok:
        logger.info("Database status: connected")
        if settings.db_auto_create and not settings.is_production:
            from app.db.session import init_db

            try:
                init_db()
                logger.info("Database schema initialized")
            except Exception as exc:  # pragma: no cover - app stays up and reports degraded status
                logger.warning("Database schema init failed: %s", exc)
    else:
        logger.warning("Database status: disconnected (%s)", db_error)

    redis_ok, redis_error = _check_redis_connection()
    if redis_ok:
        logger.info("Redis status: connected")
    else:
        logger.warning("Redis status: disconnected (%s)", redis_error)

    if settings.auth_disabled and not settings.is_production:
        # Loud, because this is the one setting that can make two accounts look
        # like one: a request with no token is served as a single shared account.
        logging.getLogger("vulnix.auth").warning(
            "VULNIX_AUTH_DISABLED is on. A request that sends no bearer token is served as the "
            "shared development account (%s), so such a request is not a real user. Any token "
            "that is presented is still verified.",
            settings.dev_user_email,
        )

    # -----------------------------------------------------------------------
    # Agentic Architecture & Specialist Sub-Agents Startup Table
    # -----------------------------------------------------------------------
    try:
        import app.agent  # triggers registration of all specialist agents
        from app.agent.router import get_swarm_status

        swarm = get_swarm_status()
        table_str = _format_swarm_table(swarm)
        logging.getLogger("vulnix.agentic").info("%s", table_str)
    except Exception as exc:  # pragma: no cover
        logger.warning("Agentic architecture startup check failed: %s", exc)

    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        # Correlate logs and error responses with a per-request id.
        request.state.request_id = uuid.uuid4().hex
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        # A route that chose its own caching (an unguessable, immutable image
        # name) keeps it; everything else is never stored.
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.get("/health", tags=["health"], summary="Liveness probe")
    def health() -> dict:
        # Liveness only. The agent registry and per-component status belong to
        # /api/v1/ready, which checks its own dependencies.
        return {"status": "ok"}

    return app


app = create_app()

"""API v1 router assembly."""

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.modules.ai import routes as ai_routes
from app.modules.auth import routes as auth_routes
from app.modules.findings import routes as findings_routes
from app.modules.integrations import oauth_routes
from app.modules.integrations import routes as integrations_routes
from app.modules.projects import routes as projects_routes
from app.modules.scans import routes as scans_routes
from app.modules.uploads import routes as uploads_routes
from app.modules.workspaces import routes as workspaces_routes

api_router = APIRouter()
api_router.include_router(auth_routes.router)
api_router.include_router(workspaces_routes.router)
# Registered first: its literal paths (/integrations/providers, /connections)
# must win against integrations_routes' /integrations/{provider} pattern.
api_router.include_router(oauth_routes.router)
api_router.include_router(integrations_routes.router)
api_router.include_router(ai_routes.router)
api_router.include_router(projects_routes.router)
api_router.include_router(uploads_routes.router)
api_router.include_router(scans_routes.router)
api_router.include_router(findings_routes.router)
api_router.include_router(oauth_routes.public_router)


@api_router.get("/ready", tags=["health"], summary="Readiness of required dependencies")
def ready() -> dict[str, str]:
    # Only reports component names/status, never connection details or secrets.
    components: dict[str, str] = {}

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        components["database"] = "up"
    except Exception:
        components["database"] = "down"

    try:
        import redis

        client = redis.Redis.from_url(settings.celery_broker_url, socket_connect_timeout=2)
        client.ping()
        components["redis"] = "up"
    except Exception:
        components["redis"] = "down"

    supabase_ok = bool(settings.supabase_url and settings.supabase_anon_key)
    fallback_ok = bool(settings.ai_fallback_enabled and settings.ai_fallback_api_key)
    components["supabase_auth"] = "configured" if supabase_ok else "not_configured"
    components["ai"] = "enabled" if settings.ai_enabled else "disabled"
    components["ai_fallback"] = "enabled" if fallback_ok else "disabled"
    # Presence of a Groq credential only - which models it can reach is probed
    # per request by the catalog, never asserted here.
    components["ai_groq"] = "configured" if settings.groq_ready else "not_configured"
    # Names and on/off only: which integrations are configured is workspace data.
    components["integrations"] = "enabled" if settings.integrations_ready else "disabled"

    try:
        from app.agent.router import get_swarm_status
        swarm = get_swarm_status()
        components["agent_router"] = swarm["router"]
        components["agent_code"] = swarm["agents"]["code"]["status"]
        components["agent_intel"] = swarm["agents"]["intel"]["status"]
        components["agent_dep"] = swarm["agents"]["dep"]["status"]
    except Exception:
        components["agent_router"] = "error"

    status = "ready" if components["database"] == "up" else "not_ready"
    return {"status": status, **components}

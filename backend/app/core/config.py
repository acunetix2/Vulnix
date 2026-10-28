"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Secrets come from the environment, never from git."""

    # App
    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "Vulnix API"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"
    # Browser origins allowed to call this API. The console is served from its own
    # host, so a deployed frontend is cross-origin by default and the browser
    # blocks it unless the origin is listed here. Comma-separated, exact scheme and
    # host, no trailing slash, no wildcards: requests carry a bearer token, so an
    # echoing wildcard would let any site read any user's findings.
    cors_allow_origins: str = ""

    # Database
    database_url: str = "sqlite:///./.data/vulnix.db"
    db_auto_create: bool = True  # dev/test convenience; production uses migrations

    # Auth (Supabase JWT by default)
    auth_disabled: bool = False  # only allowed outside production
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    dev_user_email: str = "dev@vulnix.local"

    # Supabase Auth API (email/password + OAuth proxy endpoints)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""  # server-side only; never sent to clients

    # Queue
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_eager: bool = True  # run scans inline; set false once Redis is up

    # Status history. The scheduler probes this origin and stores each
    # observation, so the public status page shows real uptime instead of
    # whatever the visitor's browser could reach. Empty means no probing.
    status_probe_url: str = ""
    status_probe_timeout_seconds: float = 10.0

    # Object storage
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_root: str = "./.data/storage"
    s3_endpoint_url: str = ""
    s3_bucket: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    # A signing region is required even for a self-described endpoint, and an
    # endpoint-less AWS client picks its own; "auto" is what R2 and the other
    # S3-compatible stores expect. Set the real region for plain Amazon S3.
    s3_region: str = "auto"

    # Upload limits
    upload_max_bytes: int = 100 * 1024 * 1024
    upload_max_files: int = 10_000
    upload_max_uncompressed_bytes: int = 1024 * 1024 * 1024
    upload_max_compression_ratio: int = 100
    upload_max_nesting_depth: int = 20
    upload_max_entry_bytes: int = 64 * 1024 * 1024
    upload_retention_days: int = 7  # quarantined archives expire after this
    upload_rate_per_hour: int = 20  # per-user upload quota
    scan_rate_per_hour: int = 20  # per-user scan creation quota

    # Scan execution
    scan_workdir: str = "./.data/scans"
    scan_total_timeout_seconds: int = 900
    scanner_timeout_seconds: int = 300

    # Scanner binaries (fixed paths; never taken from client input)
    semgrep_path: str = "semgrep"
    semgrep_config: str = "auto"  # rule pack; vendor rules locally for offline workers
    gitleaks_path: str = "gitleaks"
    bandit_path: str = "bandit"
    pip_audit_path: str = "pip-audit"
    trivy_path: str = "trivy"

    # Outbound integrations (Slack / Jira / webhooks)
    # Egress stays off until an operator turns it on deliberately. The URL
    # guards in app/core/egress.py apply whether or not this flag is on.
    integrations_enabled: bool = False
    # Fernet material for integration secrets. Any passphrase works.
    integration_secret_key: str = ""
    integration_timeout_seconds: int = 5
    integration_max_body_bytes: int = 64 * 1024
    integration_max_attempts: int = 5
    integration_backoff_base_seconds: int = 30
    # A repository archive is a download, not an API ping: it needs longer than
    # the delivery timeout but still a hard ceiling.
    integration_fetch_timeout_seconds: int = 60
    # Only set this when a self-hosted target legitimately lives on a
    # private range; it widens the SSRF guard.
    integration_allow_private_targets: bool = False

    # OAuth apps for integration connections. Client secrets live in the
    # environment and never leave the process: no response, log or audit row
    # carries one, and the console cannot set them.
    github_client_id: str = ""
    github_client_secret: str = ""
    github_app_id: str = ""
    github_app_slug: str = "vulnix-reviewer"
    github_app_private_key: str = ""
    slack_client_id: str = ""
    slack_client_secret: str = ""
    jira_client_id: str = ""
    jira_client_secret: str = ""
    # Public base of this API, used to build the redirect URI registered with
    # each provider. A relative redirect would let a proxy decide the host.
    oauth_redirect_base_url: str = ""
    # Where the browser goes once a callback has been spent. Fixed here rather
    # than taken from the request, so a callback cannot be aimed at another site.
    console_base_url: str = "http://localhost:5173"
    oauth_state_ttl_seconds: int = 600

    # AI
    ai_enabled: bool = False
    # The provider used when a workspace has not chosen a model of its own.
    ai_provider: Literal["ollama", "groq", "gemini", "openrouter", "none"] = "groq"
    # Inference on the Vulnix host is not offered as a reviewer: it is not part of
    # the hosted product, and a picker that lists a model the host has not pulled
    # invites a workspace to choose a reviewer that then cannot answer. The local
    # adapter and its settings below stay intact, so a deployment that runs its own
    # model can offer it again with this one setting (ADR-017).
    ai_local_enabled: bool = False
    ai_base_url: str = "http://localhost:11434"
    ai_model: str = ""
    ai_api_key: str = ""
    # Local CPU inference is slow and variable; fail over to the fallback
    # provider quickly rather than blocking requests for a minute.
    ai_timeout_seconds: int = 20
    # Keep the local model's context window small; large windows slow inference
    # on CPU-only hosts (qwen3.5 defaults to 262k).
    ai_num_ctx: int = 4096
    ai_max_snippet_lines: int = 40
    # Loose enough that one audit's per-file calls are not the thing that fails:
    # the daily credit budget is the real limit, and a rate trip mid-audit looks
    # like a broken deployment rather than a spent account.
    ai_rate_per_minute: int = 60
    ai_daily_quota_per_user: int = 300
    # Enable local-model reasoning by default for deeper security reviews.
    ai_disable_think: bool = False

    # An audit retries a reviewer that throttles, times out or answers with
    # unusable JSON, because that is a bad moment and not a verdict on the code.
    # Failed calls are never charged, so the retries cost time only - and they
    # are what stops one rate-limit trip from failing a whole audit.
    ai_max_retries: int = 8
    ai_retry_backoff_base_seconds: float = 1.0
    ai_retry_backoff_max_seconds: float = 10.0

    # Bound what a hosted reviewer can answer with. An open-ended completion on
    # a long file is the one place an audit can spend output tokens without
    # limit, and a reply that only just fits is what truncation checks guard.
    # Zero leaves the provider's own default in place.
    ai_max_output_tokens: int = 2048
    # A reviewer that just failed is skipped for this long. Without it, the
    # retry loop above knocks on the dead provider on every attempt before the
    # surviving one is ever reached, doubling the cost of an outage.
    # Zero means every attempt tries the primary again first.
    ai_provider_cooldown_seconds: int = 60

    # Failover: the reviewer an audit hands over to when the primary does not
    # answer. Any hosted provider can be primary or target, and a target is
    # never the provider that just failed. The named target is tried first; the
    # remaining configured reviewers follow it in catalog order.
    ai_fallback_enabled: bool = False
    ai_fallback_provider: Literal["groq", "gemini", "openrouter", "none"] = "groq"
    ai_fallback_base_url: str = "https://api.groq.com/openai/v1"
    ai_fallback_model: str = "qwen/qwen3.8-27b"
    ai_fallback_api_key: str = ""
    ai_fallback_timeout_seconds: int = 30
    # The window a handed-over prompt must still fit inside. Groq's chat models
    # are the smallest of the three, so this is the one that governs a handover
    # onto them.
    ai_fallback_context_tokens: int = 131072

    # Google AI Studio. Speaks the OpenAI-compatible chat API, so a review can
    # continue here when the primary hosted reviewer is throttling or down.
    # Its credential is deliberately separate: a Groq key must never be sent to
    # a Google endpoint by a copied variable.
    ai_gemini_api_key: str = ""
    ai_gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    ai_gemini_model: str = "gemini-2.5-flash"
    ai_gemini_timeout_seconds: int = 45
    ai_gemini_context_tokens: int = 1000000

    # OpenRouter is the narrowest window in the chain - the 32k coder model from
    # the free tier - so it is the reviewer that must be refused before the
    # request rather than after. Its credential is separate for the same reason
    # as Gemini's: a key never travels to an endpoint the operator did not name.
    ai_openrouter_api_key: str = ""
    ai_openrouter_base_url: str = "https://openrouter.ai/api/v1"
    ai_openrouter_model: str = "qwen/qwen2.5-coder-32b-instruct:free"
    ai_openrouter_timeout_seconds: int = 30
    ai_openrouter_context_tokens: int = 32768

    # Review agent - the scan's primary reader. The CLI scanners above are
    # optional inputs to it and never decide whether a scan succeeds.
    agent_enabled: bool = True
    # Zero disables each coverage or investigation budget. Operators can set a
    # positive value to cap that dimension; the scan deadline and AI quota still
    # apply independently.
    agent_max_files: int = 0
    agent_max_bytes_per_file: int = 0
    agent_max_calls: int = 0
    agent_max_investigation_turns: int = 0
    agent_max_investigation_calls: int = 0
    agent_max_context_files: int = 0
    agent_related_file_bytes: int = 0

    # Agent router — multi-specialist fan-out (Phase 1+)
    # Set to False to bypass the router and use the legacy single-agent path.
    agent_router_enabled: bool = True
    # Thread-pool cap for concurrent agent dispatches.  One slot per
    # (finding x registered agent); a large scan with many critical findings
    # can spawn up to this many threads at once.
    agent_router_max_workers: int = 6

    model_config = SettingsConfigDict(env_file=".env", env_prefix="VULNIX_", extra="ignore")

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        # Production must never run with auth off or an empty JWT secret.
        if self.app_env == "production":
            if self.auth_disabled:
                raise ValueError("auth_disabled cannot be enabled in production")
            if not self.supabase_jwt_secret and not self.supabase_jwks_url:
                raise ValueError("supabase_jwt_secret or supabase_jwks_url required in production")
            if self.integrations_enabled and not self.integration_secret_key:
                raise ValueError("integration_secret_key required when integrations are enabled")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins(self) -> list[str]:
        """The allowlist as a list; empty means no cross-origin browser is served."""
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def integrations_ready(self) -> bool:
        # Turning the feature on without a key would silently break every
        # secret write, so both conditions must hold.
        return self.integrations_enabled and bool(self.integration_secret_key)

    def oauth_app(self, provider: str) -> tuple[str, str]:
        """The registered app's (client id, client secret) for one provider."""
        if provider == "github":
            return self.github_client_id, self.github_client_secret
        if provider == "slack":
            return self.slack_client_id, self.slack_client_secret
        if provider == "jira":
            return self.jira_client_id, self.jira_client_secret
        return "", ""

    @property
    def github_app_ready(self) -> bool:
        return bool(self.github_app_id and self.github_app_slug and self.github_app_private_key)

    @property
    def oauth_ready(self) -> bool:
        # A connect flow needs somewhere to come back to as well as an app to
        # come back with, so all three parts are required.
        return bool(self.integration_secret_key and self.oauth_redirect_base_url)

    @property
    def groq_api_key(self) -> str:
        """The single Groq credential, whichever variable an operator filled in.

        ``ai_api_key`` is the provider key and ``ai_fallback_api_key`` the
        failover key; copying the same secret into both would only create a
        second thing to leak.
        """
        return self.ai_api_key or self.ai_fallback_api_key

    @property
    def groq_base_url(self) -> str:
        return self.ai_fallback_base_url

    @property
    def groq_ready(self) -> bool:
        return bool(self.groq_api_key and self.groq_base_url)

    @property
    def gemini_api_key(self) -> str:
        """The Google AI Studio credential, and only that.

        It has no fallback to another provider's variable: a key must never be
        sent to an endpoint the operator did not put it on.
        """
        return self.ai_gemini_api_key

    @property
    def gemini_base_url(self) -> str:
        return self.ai_gemini_base_url

    @property
    def gemini_ready(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_base_url)

    @property
    def openrouter_api_key(self) -> str:
        """The OpenRouter credential, and only that. Same rule as Gemini's."""
        return self.ai_openrouter_api_key

    @property
    def openrouter_base_url(self) -> str:
        return self.ai_openrouter_base_url

    @property
    def openrouter_ready(self) -> bool:
        return bool(self.openrouter_api_key and self.openrouter_base_url)

    @property
    def hosted_reviewers(self) -> tuple[str, ...]:
        """Configured hosted reviewers, in the order an audit may hand over."""
        return tuple(
            name
            for name, ready in (
                ("groq", self.groq_ready),
                ("gemini", self.gemini_ready),
                ("openrouter", self.openrouter_ready),
            )
            if ready
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

"""AI reviewer selection and usage schemas.

Nothing here carries a vendor model name. A reviewer is identified by an alias
and an opaque token; the real provider and tag stay in the server's catalog and
usage table.
"""

from pydantic import BaseModel, Field


class AiModelOut(BaseModel):
    # The opaque selection token for this entry, not an internal catalog id.
    id: str
    alias: str
    note: str


class AiSettingsOut(BaseModel):
    enabled: bool
    # The workspace's own choice, and what the server falls back to without it.
    # Both are selection tokens.
    selected: str | None
    default: str | None
    models: list[AiModelOut]
    daily_quota: int
    used_today: int


class AiSettingsUpdate(BaseModel):
    # A selection token from the model list. Raw model names are never accepted
    # from a client.
    model_id: str = Field(min_length=1, max_length=160)


class AiUsageDay(BaseModel):
    day: str
    credits: int
    prompt_tokens: int
    completion_tokens: int


class AiUsageModel(BaseModel):
    alias: str
    calls: int
    credits: int
    failures: int
    prompt_tokens: int
    completion_tokens: int
    # The most recent day this reviewer replied, so a switched-away one is
    # recognisable as stale rather than as broken.
    last_day: str


class AiUsageOut(BaseModel):
    scope: str
    since_day: str
    until_day: str
    total_credits: int
    days: list[AiUsageDay]
    models: list[AiUsageModel] = []

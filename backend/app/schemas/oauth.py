"""Schemas for consent-window connections and the resources they unlock.

Nothing here carries a credential. Connection reads report which account gave
consent and what it covers; the tokens themselves have no field to arrive in.
"""

from datetime import datetime

from pydantic import BaseModel


class ProviderCapability(BaseModel):
    provider: str
    # An OAuth app is registered and this server can complete the round trip.
    oauth_available: bool
    reason: str = ""
    redirect_uri: str = ""
    scopes: list[str] = []
    connected: bool = False
    account_label: str = ""


class ConnectOut(BaseModel):
    provider: str
    authorize_url: str
    redirect_uri: str
    scopes: list[str]
    expires_in: int


class ConnectionOut(BaseModel):
    provider: str
    connected: bool
    account_label: str = ""
    scope: str = ""
    access_expires_at: datetime | None = None
    connected_at: datetime | None = None
    details: dict = {}


class SlackChannel(BaseModel):
    id: str
    name: str
    private: bool = False


class JiraSite(BaseModel):
    id: str
    url: str
    name: str


class JiraProject(BaseModel):
    id: str
    key: str
    name: str


class GitHubRepository(BaseModel):
    id: int
    full_name: str
    private: bool = False
    default_branch: str = ""
    description: str = ""
    pushed_at: str = ""
    selected: bool = False


class RepositoryListOut(BaseModel):
    repositories: list[GitHubRepository]
    selected: list[GitHubRepository] = []
    truncated: bool = False


class JiraSetupOut(BaseModel):
    sites: list[JiraSite] = []
    projects: list[JiraProject] = []
    site_id: str = ""

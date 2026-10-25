"""OAuth connections: one consented external account link per workspace provider

Revision ID: d9f4c2b7e1a3
Revises: c7a3e5d21b48
Create Date: 2026-10-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'd9f4c2b7e1a3'
down_revision = 'c7a3e5d21b48'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('oauth_connections',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('workspace_id', sa.String(length=36), nullable=False),
    sa.Column('provider', sa.String(length=16), nullable=False),
    sa.Column('account_label', sa.String(length=160), nullable=False),
    sa.Column('scope', sa.String(length=512), nullable=False),
    sa.Column('access_expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('access_enc', sa.Text(), nullable=True),
    sa.Column('refresh_enc', sa.Text(), nullable=True),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('connected_by', sa.String(length=36), nullable=False),
    sa.Column('connected_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("provider IN ('slack','jira','github')", name='ck_oauth_connection_provider'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('workspace_id', 'provider', name='uq_oauth_connection_workspace_provider')
    )
    op.create_index('ix_oauth_connection_workspace', 'oauth_connections', ['workspace_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_oauth_connection_workspace', table_name='oauth_connections')
    op.drop_table('oauth_connections')

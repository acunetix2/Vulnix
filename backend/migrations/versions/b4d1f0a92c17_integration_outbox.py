"""integration configs, webhooks and delivery outbox

Revision ID: b4d1f0a92c17
Revises: 628759b7406c
Create Date: 2026-10-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'b4d1f0a92c17'
down_revision = '628759b7406c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('integration_configs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('workspace_id', sa.String(length=36), nullable=False),
    sa.Column('provider', sa.String(length=16), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.Column('config', sa.JSON(), nullable=False),
    sa.Column('secret_enc', sa.Text(), nullable=True),
    sa.Column('secret_hint', sa.String(length=16), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("provider IN ('slack','jira')", name='ck_integration_configs_provider'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('workspace_id', 'provider', name='uq_integration_workspace_provider')
    )
    op.create_index('ix_integration_workspace', 'integration_configs', ['workspace_id'], unique=False)
    op.create_table('webhook_endpoints',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('workspace_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('url', sa.String(length=1024), nullable=False),
    sa.Column('events', sa.JSON(), nullable=False),
    sa.Column('secret_enc', sa.Text(), nullable=True),
    sa.Column('secret_hint', sa.String(length=16), nullable=True),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_webhook_workspace_created', 'webhook_endpoints', ['workspace_id', 'created_at'], unique=False)
    op.create_table('integration_deliveries',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('workspace_id', sa.String(length=36), nullable=False),
    sa.Column('channel', sa.String(length=16), nullable=False),
    sa.Column('target_id', sa.String(length=36), nullable=True),
    sa.Column('target_label', sa.String(length=255), nullable=False),
    sa.Column('event_type', sa.String(length=64), nullable=False),
    sa.Column('resource_type', sa.String(length=32), nullable=False),
    sa.Column('resource_id', sa.String(length=36), nullable=True),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_error_code', sa.String(length=64), nullable=True),
    sa.Column('http_status', sa.Integer(), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("channel IN ('slack','jira','webhook')", name='ck_deliveries_channel'),
    sa.CheckConstraint("status IN ('pending','succeeded','failed','dead')", name='ck_deliveries_status'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_deliveries_status_next', 'integration_deliveries', ['status', 'next_attempt_at'], unique=False)
    op.create_index('ix_deliveries_workspace_created', 'integration_deliveries', ['workspace_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_deliveries_workspace_created', table_name='integration_deliveries')
    op.drop_index('ix_deliveries_status_next', table_name='integration_deliveries')
    op.drop_table('integration_deliveries')
    op.drop_index('ix_webhook_workspace_created', table_name='webhook_endpoints')
    op.drop_table('webhook_endpoints')
    op.drop_index('ix_integration_workspace', table_name='integration_configs')
    op.drop_table('integration_configs')

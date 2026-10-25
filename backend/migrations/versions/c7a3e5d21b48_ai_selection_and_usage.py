"""workspace AI model selection and per-call usage events

Revision ID: c7a3e5d21b48
Revises: b4d1f0a92c17
Create Date: 2026-10-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'c7a3e5d21b48'
down_revision = 'b4d1f0a92c17'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('workspace_ai_settings',
    sa.Column('workspace_id', sa.String(length=36), nullable=False),
    sa.Column('model_id', sa.String(length=160), nullable=False),
    sa.Column('updated_by', sa.String(length=36), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('workspace_id')
    )
    op.create_table('ai_usage_events',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('workspace_id', sa.String(length=36), nullable=True),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('finding_id', sa.String(length=36), nullable=True),
    sa.Column('provider', sa.String(length=32), nullable=False),
    sa.Column('model', sa.String(length=160), nullable=False),
    sa.Column('day', sa.String(length=10), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('error_code', sa.String(length=64), nullable=True),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('latency_ms', sa.BigInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("status IN ('succeeded','failed')", name='ck_ai_usage_status'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ai_usage_user_day', 'ai_usage_events', ['user_id', 'day'], unique=False)
    op.create_index('ix_ai_usage_workspace_day', 'ai_usage_events', ['workspace_id', 'day'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_ai_usage_workspace_day', table_name='ai_usage_events')
    op.drop_index('ix_ai_usage_user_day', table_name='ai_usage_events')
    op.drop_table('ai_usage_events')
    op.drop_table('workspace_ai_settings')

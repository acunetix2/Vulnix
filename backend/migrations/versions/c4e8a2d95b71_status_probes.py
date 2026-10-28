"""scheduler-authored status history

Revision ID: c4e8a2d95b71
Revises: f2a6c0b4d8e1
Create Date: 2026-10-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'c4e8a2d95b71'
down_revision = 'f2a6c0b4d8e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('status_probes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('checked_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('reachable', sa.Boolean(), nullable=False),
    sa.Column('http_status', sa.Integer(), nullable=True),
    sa.Column('latency_ms', sa.Integer(), nullable=True),
    sa.Column('components', sa.JSON(), nullable=False),
    sa.Column('error_code', sa.String(length=64), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_status_probes_checked', 'status_probes', ['checked_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_status_probes_checked', table_name='status_probes')
    op.drop_table('status_probes')

"""the welcome sequence is closed on the account row, not in a browser

Revision ID: f2a6c0b4d8e1
Revises: b7d2f4a1c8e3
Create Date: 2026-10-23 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'f2a6c0b4d8e1'
down_revision = 'b7d2f4a1c8e3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('onboarding_completed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'onboarding_completed_at')

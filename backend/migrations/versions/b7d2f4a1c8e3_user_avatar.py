"""profile picture on the account row

Revision ID: b7d2f4a1c8e3
Revises: a3c9e1f7b254
Create Date: 2026-10-23 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'b7d2f4a1c8e3'
down_revision = 'a3c9e1f7b254'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar_url')

"""suggested edits: the agent's validated patch, stored per finding

Revision ID: a3c9e1f7b254
Revises: e1b7c4a8f902
Create Date: 2026-10-23 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'a3c9e1f7b254'
down_revision = 'e1b7c4a8f902'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('findings', sa.Column('suggestion', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('findings', 'suggestion')

"""Username handle: the console shows this instead of the account primary key

Revision ID: e1b7c4a8f902
Revises: d9f4c2b7e1a3
Create Date: 2026-10-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'e1b7c4a8f902'
down_revision = 'd9f4c2b7e1a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('username', sa.String(length=30), nullable=True))
    # Batch mode: SQLite cannot add a constraint with ALTER, Postgres can, and
    # this migration has to be safe on either.
    with op.batch_alter_table('users') as batch_op:
        batch_op.create_unique_constraint('uq_users_username', ['username'])


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('uq_users_username', type_='unique')
    op.drop_column('users', 'username')

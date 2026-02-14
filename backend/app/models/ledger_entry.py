import uuid
import enum
from datetime import datetime

from sqlalchemy import Text, DateTime, ForeignKey, Numeric, Enum as SAEnum, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Direction(str, enum.Enum):
    debit = "debit"
    credit = "credit"


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index("idx_ledger_user_id", "user_id"),
        Index("idx_ledger_contact_id", "contact_id"),
        Index("idx_ledger_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )
    direction: Mapped[Direction] = mapped_column(
        SAEnum(Direction, name="entry_direction", native_enum=True),
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=True,
    )

from typing import List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)

    users: Mapped[List["User"]] = relationship(  # noqa: F821
        back_populates="organization", cascade="all, delete-orphan"
    )
    workflows: Mapped[List["Workflow"]] = relationship(  # noqa: F821
        back_populates="organization", cascade="all, delete-orphan"
    )
    records: Mapped[List["Record"]] = relationship(  # noqa: F821
        back_populates="organization", cascade="all, delete-orphan"
    )

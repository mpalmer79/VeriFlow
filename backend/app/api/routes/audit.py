from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core import evidence_storage
from app.core.database import get_db
from app.models.document import Document
from app.models.enums import UserRole
from app.models.record import Record
from app.models.user import User
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditChainReport(BaseModel):
    organization_id: Optional[int]
    checked: int
    ok: bool
    broken_entries: List[Dict[str, Any]]
    broken_links: List[Dict[str, Any]]


class StorageInventoryReport(BaseModel):
    managed_files_on_disk: int
    total_bytes_on_disk: int
    referenced_by_organization: int
    total_bytes_referenced_by_organization: int
    dangling_references_in_organization: int
    orphaned_files: int


class StorageCleanupReport(BaseModel):
    dry_run: bool
    files_examined: int
    orphaned_found: int
    orphaned_deleted: int
    bytes_reclaimed: int
    errors: int


# Admin/debug routes — elevated role required. `require_roles` chains
# through `get_current_user` so the dependency still yields a User.
AdminUser = Depends(require_roles(UserRole.ADMIN))


@router.get("/verify", response_model=AuditChainReport)
def verify_audit_chain(
    db: Session = Depends(get_db),
    current_user: User = AdminUser,
):
    report = audit_service.verify_chain(db, current_user.organization_id)
    return AuditChainReport(**report)


@router.get("/storage-inventory", response_model=StorageInventoryReport)
def storage_inventory(
    db: Session = Depends(get_db),
    current_user: User = AdminUser,
):
    """Read-only dry-run report comparing managed files on disk against
    live `Document` rows. Counts are safe to expose at org scope; file
    paths and cross-organization filenames are not surfaced.
    """
    disk_paths: dict[str, int] = {}
    total_bytes_on_disk = 0
    for path, size in evidence_storage.iter_managed_files():
        resolved = str(path.resolve())
        disk_paths[resolved] = size
        total_bytes_on_disk += size

    # Gather every live local storage URI across the whole deployment so
    # we can compute orphans (on disk but unreferenced anywhere).
    all_uris = list(
        db.execute(
            select(Document.storage_uri).where(Document.storage_uri.isnot(None))
        ).scalars()
    )
    referenced_paths: set[str] = set()
    for uri in all_uris:
        path = evidence_storage.resolve_local_path(uri)
        if path is not None:
            referenced_paths.add(str(path.resolve()))

    orphaned_files = sum(
        1 for resolved in disk_paths if resolved not in referenced_paths
    )

    # Now compute the caller's org-scoped view.
    org_uris = list(
        db.execute(
            select(Document.storage_uri)
            .join(Record, Record.id == Document.record_id)
            .where(
                Record.organization_id == current_user.organization_id,
                Document.storage_uri.isnot(None),
            )
        ).scalars()
    )
    referenced_by_organization = 0
    total_bytes_referenced_by_organization = 0
    dangling = 0
    for uri in org_uris:
        path = evidence_storage.resolve_local_path(uri)
        if path is None:
            # URI is local-shaped but file is missing, or it is not under
            # the managed root at all. Either way treat as dangling so
            # operators can investigate.
            if evidence_storage.is_local_uri(uri):
                dangling += 1
            continue
        referenced_by_organization += 1
        total_bytes_referenced_by_organization += disk_paths.get(
            str(path.resolve()), 0
        )

    return StorageInventoryReport(
        managed_files_on_disk=len(disk_paths),
        total_bytes_on_disk=total_bytes_on_disk,
        referenced_by_organization=referenced_by_organization,
        total_bytes_referenced_by_organization=total_bytes_referenced_by_organization,
        dangling_references_in_organization=dangling,
        orphaned_files=orphaned_files,
    )


@router.post("/storage-cleanup", response_model=StorageCleanupReport)
def storage_cleanup(
    dry_run: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = AdminUser,
):
    """Sweep orphaned managed files. Default is a dry run; destructive
    deletion requires `?dry_run=false` and is performed only against
    files inside the configured storage root. Files referenced by any
    live `Document` row are never deleted.
    """
    referenced_paths: set[str] = set()
    all_uris = list(
        db.execute(
            select(Document.storage_uri).where(Document.storage_uri.isnot(None))
        ).scalars()
    )
    for uri in all_uris:
        path = evidence_storage.resolve_local_path(uri)
        if path is not None:
            referenced_paths.add(str(path.resolve()))

    files_examined = 0
    orphaned_found = 0
    orphaned_deleted = 0
    bytes_reclaimed = 0
    errors = 0

    for path, size in evidence_storage.iter_managed_files():
        files_examined += 1
        resolved = str(path.resolve())
        if resolved in referenced_paths:
            continue
        orphaned_found += 1
        if dry_run:
            continue
        if evidence_storage.delete_file_inside_root(path):
            orphaned_deleted += 1
            bytes_reclaimed += size
        else:
            errors += 1

    audit_service.record_event(
        db,
        action="storage.cleanup",
        entity_type="storage",
        organization_id=current_user.organization_id,
        actor_user_id=current_user.id,
        payload={
            "dry_run": dry_run,
            "files_examined": files_examined,
            "orphaned_found": orphaned_found,
            "orphaned_deleted": orphaned_deleted,
            "bytes_reclaimed": bytes_reclaimed,
            "errors": errors,
        },
    )
    db.commit()

    return StorageCleanupReport(
        dry_run=dry_run,
        files_examined=files_examined,
        orphaned_found=orphaned_found,
        orphaned_deleted=orphaned_deleted,
        bytes_reclaimed=bytes_reclaimed,
        errors=errors,
    )

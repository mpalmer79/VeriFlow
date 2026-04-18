import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    INTAKE_COORDINATOR = "intake_coordinator"
    REVIEWER = "reviewer"
    MANAGER = "manager"


class RecordStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    READY = "ready"
    CLOSED = "closed"


class InsuranceStatus(str, enum.Enum):
    UNKNOWN = "unknown"
    PENDING = "pending"
    VERIFIED = "verified"
    UNINSURED_ACKNOWLEDGED = "uninsured_acknowledged"
    INVALID = "invalid"


class ConsentStatus(str, enum.Enum):
    NOT_PROVIDED = "not_provided"
    PARTIAL = "partial"
    SIGNED = "signed"
    EXPIRED = "expired"


class MedicalHistoryStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    INCOMPLETE = "incomplete"
    COMPLETE = "complete"


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"


class DocumentType(str, enum.Enum):
    PHOTO_ID = "photo_id"
    INSURANCE_CARD = "insurance_card"
    CONSENT_FORM = "consent_form"
    GUARDIAN_AUTHORIZATION = "guardian_authorization"
    MEDICAL_HISTORY_FORM = "medical_history_form"
    OTHER = "other"


class RiskBand(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class RuleActionType(str, enum.Enum):
    WARN = "warn"
    BLOCK = "block"


class RuleSeverity(str, enum.Enum):
    WARNING = "warning"
    HIGH = "high"
    CRITICAL = "critical"


class RuleActionApplied(str, enum.Enum):
    NONE = "none"
    WARN = "warn"
    BLOCK = "block"

export type DocumentType =
  | "identity"
  | "marksheet"
  | "income-certificate"
  | "bank-proof"
  | "scholarship-application";

export type ExtractionMethod = "ocr" | "multimodal" | "manual" | "synthetic";

export type Evidence = {
  id: string;
  documentId: string;
  page?: number;
  field?: string;
  text?: string;
  bbox?: [number, number, number, number];
  extractionMethod: ExtractionMethod;
  confidence?: number;
};

export type ExtractedField<T = string> = {
  value: T;
  evidenceIds: string[];
  confidence?: number;
};

export type DocumentStatus = "present" | "missing" | "expired" | "invalid";

export type ApplicantProfile = {
  name?: ExtractedField<string>;
  dateOfBirth?: ExtractedField<string>;
  address?: ExtractedField<string>;
  requiredDocuments: Record<DocumentType, DocumentStatus>;
  version: string;
};

export type Finding = {
  ruleId: string;
  severity: "critical" | "error" | "warning";
  message: string;
  evidenceIds: string[];
  blocking: boolean;
};

export type PreflightResult = {
  status: "READY" | "BLOCKED";
  issues: Finding[];
  checkedAt: string;
  profileVersion: string;
};

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Approval = {
  status: ApprovalStatus;
  profileVersion: string;
};

export type PortalRunState =
  | "NOT_STARTED"
  | "FILLED"
  | "AWAITING_APPROVAL"
  | "SUBMITTING"
  | "SUBMITTED"
  | "VERIFIED"
  | "UNKNOWN"
  | "FAILED";

export type PortalRun = {
  runId: string;
  state: PortalRunState;
  profileVersion: string;
};

export type DemoScenario =
  | "clean"
  | "name-mismatch"
  | "portal-label-change"
  | "submit-timeout";

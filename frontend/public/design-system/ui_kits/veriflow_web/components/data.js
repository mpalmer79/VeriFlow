// Mocked data used across the VeriFlow UI kit.
window.VF_DATA = (function () {
  const stages = [
    { id: "received",   label: "Received" },
    { id: "intake",     label: "Intake" },
    { id: "identity",   label: "Identity" },
    { id: "coverage",   label: "Coverage check" },
    { id: "triage",     label: "Triage" },
    { id: "scheduled",  label: "Scheduled" },
    { id: "visit",      label: "Visit" },
    { id: "review",     label: "Review" },
    { id: "closed",     label: "Closed" },
  ];

  const records = [
    { id: "VF-2417-03A", subject: "Alejandra Ortega",  stage: "coverage",  risk: 68, status: "blocked",  updated: "14m ago", version: 14, assignee: "M. Palmer" },
    { id: "VF-2417-04B", subject: "Marcus Wen",        stage: "triage",    risk: 41, status: "progress", updated: "32m ago", version: 9,  assignee: "J. Azeez" },
    { id: "VF-2417-05C", subject: "Priya Iyengar",     stage: "identity",  risk: 22, status: "progress", updated: "1h ago",  version: 5,  assignee: "M. Palmer" },
    { id: "VF-2417-06D", subject: "Theo Kovalenko",    stage: "scheduled", risk: 54, status: "progress", updated: "2h ago",  version: 12, assignee: "S. Rhee" },
    { id: "VF-2417-07E", subject: "Sienna Abebe",      stage: "intake",    risk: 12, status: "progress", updated: "3h ago",  version: 2,  assignee: "—" },
    { id: "VF-2417-08F", subject: "Guillermo Paredes", stage: "review",    risk: 76, status: "blocked",  updated: "3h ago",  version: 18, assignee: "J. Azeez" },
    { id: "VF-2417-09G", subject: "Noor Hashemi",      stage: "visit",     risk: 33, status: "progress", updated: "5h ago",  version: 11, assignee: "S. Rhee" },
    { id: "VF-2417-10H", subject: "Deshawn Bright",    stage: "closed",    risk: 8,  status: "closed",   updated: "yesterday", version: 22, assignee: "M. Palmer" },
  ];

  const blocking = [
    { code: "insurance.status_known", severity: "critical", message: "Coverage status not resolved; cannot advance from Intake." },
    { code: "identity.proofed",       severity: "high",     message: "Gov-ID image is low-resolution; require re-upload." },
  ];
  const warnings = [
    { code: "appointment.confirmed",  severity: "moderate", message: "Patient has not confirmed in 48h." },
    { code: "address.verified",       severity: "moderate", message: "Billing address uses a shared PO box." },
  ];

  const evidence = [
    { id: "ev-01", name: "gov_id_front.png",      kind: "image",  status: "verified", hash: "a1b6…c9f3", uploaded: "14m ago" },
    { id: "ev-02", name: "gov_id_back.png",       kind: "image",  status: "rejected", hash: "0e77…4b21", uploaded: "14m ago", note: "Low resolution." },
    { id: "ev-03", name: "coverage_letter.pdf",   kind: "pdf",    status: "pending",  hash: "—",         uploaded: "just now" },
    { id: "ev-04", name: "intake_form_signed.pdf",kind: "pdf",    status: "verified", hash: "7f12…99ae", uploaded: "1h ago" },
  ];

  const audit = [
    { n: 41, at: "12:04:22", actor: "M. Palmer",       action: "evidence.reject", ref: "ev-02",       prev: "9c3f…02e1", hash: "a41b…77d0" },
    { n: 40, at: "12:04:07", actor: "system",          action: "evaluation.run",  ref: "rule_set",    prev: "64a2…1109", hash: "9c3f…02e1" },
    { n: 39, at: "12:03:55", actor: "J. Azeez",        action: "evidence.upload", ref: "ev-03",       prev: "1d8e…a402", hash: "64a2…1109" },
    { n: 38, at: "11:49:18", actor: "system",          action: "stage.enter",     ref: "coverage",    prev: "3a6f…f210", hash: "1d8e…a402" },
    { n: 37, at: "11:49:17", actor: "M. Palmer",       action: "transition.try",  ref: "identity→coverage", prev: "40c8…abe4", hash: "3a6f…f210" },
    { n: 36, at: "11:47:02", actor: "system",          action: "evaluation.run",  ref: "rule_set",    prev: "88d1…5577", hash: "40c8…abe4" },
  ];

  return { stages, records, blocking, warnings, evidence, audit };
})();

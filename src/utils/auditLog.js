

export const AUDIT_LOGS_KEY = "fhilar-studio-audit-logs-v1";

const randomId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

function safeRead() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    throw new Error("Activity Logs could not be read from this browser.");
  }
}

export function readAuditLogs() {
  return safeRead().sort((a, b) =>
    String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
  );
}

/** Only use approved, non-sensitive fields. Never serialize an auth account. */
export function makeAuditEntry({ actor, module, action, recordId, subject, before = null, after = null, changes = null, reason = "" }) {
  return {
    id: randomId(),
    timestamp: new Date().toISOString(),
    actorId: String(actor?.id || "unknown"),
    actorName: String(actor?.name || "Administrator"),
    actorRole: actor?.role === "super_admin" ? "Super Admin" : "Admin",
    module: String(module || "System"),
    action: String(action || "Updated"),
    recordId: String(recordId || ""),
    subject: String(subject || ""),
    before,
    after,
    changes,
    reason: String(reason || "").slice(0, 300)
  };
}

export function appendAuditEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  // Logs remain in a separate key so a workspace reset does not erase them.
  // No interface action can edit or delete this history.
  const current = safeRead();
  localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify([...current, ...entries]));
}

export function appendAuditEvent(details) {
  appendAuditEntries([makeAuditEntry(details)]);
}

const number = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fixed = v => number(v).toFixed(2);
const emptyToDash = v => v == null || v === "" ? "—" : v;

function summarize(module, record) {
  if (!record) return null;

  if (module === "Employees") {
    return {
      "Employee ID": record.id,
      "Full Name": record.name,
      "Position": record.position,
      "Department": record.department,
      "Assigned Shift": record.shift,
      "Custom Hourly Rate": emptyToDash(record.customRate),
      "Active": record.active !== false ? "Yes" : "No"
    };
  }

  if (module === "Attendance") {
    return {
      "Employee ID": record.employeeId,
      "Shift": record.shift,
      "Time In": record.timeIn,
      "Time Out": emptyToDash(record.timeOut),
      "Break Start": emptyToDash(record.breakStart),
      "Break End": emptyToDash(record.breakEnd),
      "Hourly Rate": fixed(record.rate),
      "Approval": record.status,
      "Payroll ID": emptyToDash(record.payrollId),
      "Entry Method": emptyToDash(record.entryMethod),
      "Minutes Late": record.late?.minutesLate ?? "—",
      "Time Out Corrections": (record.timeOutCorrections || []).length
    };
  }

  if (module === "Absences") {
    return {
      "Employee ID": record.employeeId,
      "Work Date": record.date,
      "Reason": emptyToDash(record.reason)
    };
  }

  if (module === "Leaves") {
    return {
      "Employee ID": record.employeeId,
      "Leave Type": record.type,
      "Start Date": record.start,
      "End Date": record.end,
      "Status": record.status,
      "Reviewed By": emptyToDash(record.reviewedBy)
    };
  }

  if (module === "Cutoff Reviews") {
    return {
      "Attendance ID": record.attendanceId,
      "Employee ID": record.employeeId,
      "Review Status": record.status,
      "Explanation": emptyToDash(record.explanation),
      "CEO Decision Note": emptyToDash(record.decisionNote),
      "Reviewed By": emptyToDash(record.reviewedByName || record.reviewedBy),
      "Review History Count": (record.history || []).length
    };
  }

  if (module === "Payroll") {
    const out = {
      "Payroll ID": record.id,
      "Period From": record.start,
      "Period To": record.end,
      "Status": record.status,
      "Payment Date": emptyToDash(record.paymentDate),
      "Payment Reference": emptyToDash(record.paymentReference),
      "Employees": (record.lines || []).length,
      "Total Gross": fixed((record.lines || []).reduce((s, l) => s + number(l.gross), 0)),
      "Total Net": fixed((record.lines || []).reduce((s, l) => s + number(l.net ?? l.gross), 0))
    };
    for (const line of record.lines || []) {
      // Include changed employee-level totals, but not full attendance snapshots.
      out[`Pay Line ${line.employeeId}`] =
        `Gross ₱${fixed(line.gross)} · Extra ₱${fixed(line.extraPay)} · ` +
        `Late ₱${fixed(line.lateDeduction)} · Other Ded. ₱${fixed(line.otherDeduction)} · ` +
        `Net ₱${fixed(line.net ?? line.gross)}`;
    }
    return out;
  }

  if (module === "Archives") {
    return {
      "Archived Type": record.type,
      "Record Label": record.label,
      "Original Record ID": emptyToDash(record.record?.id),
      "Deleted At": record.deletedAt,
      "Deleted By": record.deletedByName
    };
  }

  if (module === "Company Settings") {
    const out = {
      "Company Name": record.company,
      "Night Differential (%)": record.nightPercent,
      "Night Window Starts": record.nightStart,
      "Night Window Ends": record.nightEnd
    };
    for (const [key, shift] of Object.entries(record.shifts || {})) {
      out[`Shift ${key}`] = `${shift.start} to ${shift.end} · ₱${fixed(shift.rate)}/hr`;
    }
    return out;
  }

  return {};
}

function buildChanges(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter(key =>
    JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null)
  ).map(field => ({
    field,
    before: before?.[field] ?? "—",
    after: after?.[field] ?? "—"
  }));
}

const collections = [
  ["employees", "Employees", "id"],
  ["attendance", "Attendance", "id"],
  ["absences", "Absences", "id"],
  ["leaves", "Leaves", "id"],
  ["cutoffReviews", "Cutoff Reviews", "attendanceId"],
  ["runs", "Payroll", "id"],
  ["archives", "Archives", "id"]
];

function subjectFor(module, record, workspace) {
  if (module === "Employees") return `${record.name || "Employee"} · ${record.id}`;
  if (module === "Payroll") return `Payroll ${record.id}`;
  if (module === "Archives") return record.label || record.id;
  const employeeId = record.employeeId;
  const name = workspace.employees?.find(e => e.id === employeeId)?.name;
  if (module === "Attendance") return `${name || employeeId} · Attendance`;
  if (module === "Absences") return `${name || employeeId} · ${record.date}`;
  if (module === "Leaves") return `${name || employeeId} · ${record.type || "Leave"}`;
  if (module === "Cutoff Reviews") return `${name || employeeId} · Cutoff Review`;
  return record.id || "Record";
}

function wasArchiveRestored(archive, workspace) {
  if (!archive || !workspace) return false;
  const id = archive.record?.id;
  const keys = {
    attendance: "attendance",
    absence: "absences",
    leave: "leaves",
    payroll: "runs"
  };
  if (archive.type === "workspace") {
    return Boolean(workspace.employees?.length || workspace.attendance?.length || workspace.runs?.length);
  }
  const key = keys[archive.type];
  return Boolean(key && id && (workspace[key] || []).some(record => record.id === id));
}

function describeChange(module, previous, current, kind) {
  if (module === "Archives") {
    return kind === "Added" ? "Moved to Archives" : kind === "Deleted" ? "Restored or permanently removed" : "Updated Archive";
  }
  if (module === "Attendance" && previous && current) {
    const oldCorrections = (previous.timeOutCorrections || []).length;
    const newCorrections = (current.timeOutCorrections || []).length;
    if (newCorrections > oldCorrections) return "Corrected Time Out";
    if (previous.status === "Open" && current.status === "Draft") return "Time Out";
    if (previous.status === "Draft" && current.status === "Approved") return "Approved Attendance";
    if (previous.status === "Approved" && current.status === "Draft") return "Reopened Attendance";
    if (previous.payrollId !== current.payrollId && previous.timeIn === current.timeIn && previous.timeOut === current.timeOut) {
      return current.payrollId ? "Locked to Payroll" : "Unlocked from Payroll";
    }
    return "Edited Attendance";
  }
  if (module === "Attendance" && kind === "Added") {
    return current?.entryMethod === "clock" ? "Time In" : "Added Attendance";
  }
  if (module === "Employees" && previous && current && previous.active && current.active === false) {
    return "Deactivated Employee";
  }
  if (module === "Leaves" && previous && current && previous.status !== current.status) {
    return `${current.status} Leave`;
  }
  if (module === "Cutoff Reviews" && previous && current && previous.status !== current.status) {
    return `${current.status === "Pending" ? "Reopened" : current.status} Cutoff Review`;
  }
  if (module === "Payroll" && previous && current && previous.status !== current.status) {
    return `Payroll ${current.status}`;
  }
  if (module === "Payroll" && previous && current) return "Adjusted Payroll";
  return `${kind} ${module === "Employees" ? "Employee" : module === "Absences" ? "Absence" : module === "Leaves" ? "Leave" : module === "Cutoff Reviews" ? "Cutoff Review" : module === "Payroll" ? "Payroll" : "Record"}`;
}

/**
 * Run only AFTER an action has validated and successfully changed next workspace.
 * Generates one event for each changed record. The original data is untouched.
 */
export function buildWorkspaceAuditEntries(previousWorkspace, nextWorkspace, actor) {
  const entries = [];
  for (const [collectionKey, module, idKey] of collections) {
    const beforeRecords = previousWorkspace[collectionKey] || [];
    const afterRecords = nextWorkspace[collectionKey] || [];
    const oldMap = new Map(beforeRecords.map(record => [String(record[idKey]), record]));
    const newMap = new Map(afterRecords.map(record => [String(record[idKey]), record]));
    const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
    for (const id of ids) {
      const oldRecord = oldMap.get(id);
      const newRecord = newMap.get(id);
      const oldSummary = summarize(module, oldRecord);
      const newSummary = summarize(module, newRecord);
      const changes = buildChanges(oldSummary, newSummary);
      if (!changes.length) continue;
      const kind = !oldRecord ? "Added" : !newRecord ? "Deleted" : "Updated";
      const record = newRecord || oldRecord;
      const action = module === "Archives" && oldRecord && !newRecord
        ? (wasArchiveRestored(oldRecord, nextWorkspace)
          ? "Restored from Archives"
          : "Permanently Deleted Archive")
        : describeChange(module, oldRecord, newRecord, kind);
      entries.push(makeAuditEntry({
        actor,
        module,
        action,
        recordId: id,
        subject: subjectFor(module, record, nextWorkspace),
        before: oldSummary,
        after: newSummary,
        changes
      }));
    }
  }
  const beforeSettings = summarize("Company Settings", previousWorkspace.settings);
  const afterSettings = summarize("Company Settings", nextWorkspace.settings);
  const settingsChanges = buildChanges(beforeSettings, afterSettings);
  if (settingsChanges.length) {
    entries.push(makeAuditEntry({
      actor,
      module: "Company Settings",
      action: "Updated Company Settings",
      recordId: "COMPANY-SETTINGS",
      subject: String(nextWorkspace.settings?.company || "FHILAR Apparel"),
      before: beforeSettings,
      after: afterSettings,
      changes: settingsChanges
    }));
  }
  return entries;
}

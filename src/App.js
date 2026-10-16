


import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import CEOOverview from "./pages/CEOOverview";
import {
  getSessionAdmin,
  loginAdmin,
  logoutAdmin,
  updateAdminProfile,
  changeAdminPassword,
  listAdmins,
  removeAdminAccount,
  reactivateAdminAccount,
  createAdminByCEO,
  resetAdminPasswordByCEO
} from "./utils/auth";
import { FirstLoginPasswordChange } from "./pages/Login";
import Leaves from "./pages/Leaves";
import Archives from "./pages/Archives";
import ActivityLogs from "./pages/ActivityLogs";
import { buildWorkspaceAuditEntries, appendAuditEntries, appendAuditEvent } from "./utils/auditLog";
import {
  calculateLate, lateForRecord, attendanceForDay, approvedLeaveForDay,
  pendingLeaveForDay, isScheduledWeekday
} from "./utils/attendanceRules";
import {
  createLeaveRequest,
  validateLeaveRequest
} from "./utils/leave";
import {
  loadData,
  saveData,
  createInitialData,
  calculatePay,
  createRule,
  createPayrollLines,
  getRate,
  getShiftLabel,
  phDate,
  localInputToISO,
  workDate,
  roundMoney
} from "./utils/payroll";
const titles = {
  dashboard: "Dashboard",
  ceo: "CEO Overview",
  employees: "Employees",
  attendance: "Attendance",
  leaves: "Leaves",
  payroll: "Payroll",
  reports: "Reports",
  settings: "Settings",
  archives: "Archives",
  activityLogs: "Activity Logs"
};
const newId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const clone = value => JSON.parse(JSON.stringify(value));

// Older saved workspaces may not have a leaves array yet.
function withLeaveData(workspace) {
  return {
    ...workspace,
    leaves: Array.isArray(workspace.leaves) ? workspace.leaves : [],
    absences: Array.isArray(workspace.absences) ? workspace.absences : [],
    cutoffReviews: Array.isArray(workspace.cutoffReviews) ? workspace.cutoffReviews : [],
    archives: Array.isArray(workspace.archives) ? workspace.archives : []
  };
}
export default function App() {
  const [admin, setAdmin] = useState(() => {
  try {
    return getSessionAdmin();
  } catch {
    return null;
  }
});
const isSuperAdmin =
  admin?.role === "super_admin";
function requireSuperAdmin() {
  if (isSuperAdmin) return true;
  setNotice({
    type: "error",
    text: "This action requires Super Admin approval."
  });
  return false;
}
const [data, setData] = useState(() => withLeaveData(loadData()));
const [page, setPage] = useState("dashboard");
const [notice, setNotice] = useState(null);
const [signingOut, setSigningOut] = useState(false);
// Save to shared company workspace while an admin is signed in
useEffect(() => {
// Only save while an admin is signed in.
  if (!admin?.id) return;
  try {
    saveData(data);
  } catch (error) {
    console.error("Workspace save failed:", error);
    setNotice({
      type: "error",
      text: "Unable to save shared FHILAR records."
    });
  }
}, [data, admin?.id]);
useEffect(() => {
  if (!notice) return;
  const timer = setTimeout(() => {
    setNotice(null);
  }, 4000);
  return () => clearTimeout(timer);
}, [notice]);
async function handleLogin(form) {
  const signedIn = await loginAdmin(form);
// Load the company's shared records.
  const sharedData = withLeaveData(loadData());
  setData(sharedData);
  setAdmin(signedIn);
setPage(
  signedIn.role === "super_admin"
    ? "ceo"
    : "dashboard"
);
  setNotice({
    type: "success",
    text: `Welcome back, ${signedIn.name}! ♡`
  });
}
function handleLogout() {
  if (signingOut) return;
  setSigningOut(true);
  window.setTimeout(() => {
    logoutAdmin();
    setAdmin(null);
    setPage("dashboard");
    setNotice(null);
    setSigningOut(false);
  }, 2500);
}
  function saveAdminProfile(form) {
    try {
      const updated = updateAdminProfile(admin.id, form);
      setAdmin(updated);
      setNotice({ type: "success", text: "Admin profile updated! ♡" });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }
  async function saveAdminPassword(oldPassword, newPassword, confirmation) {
    try {
      await changeAdminPassword(admin.id, oldPassword, newPassword, confirmation);
      // Refresh mandatory-first-login flag and profile timestamps immediately.
      setAdmin(getSessionAdmin());
      setNotice({ type: "success", text: "Your new password is saved! ♡" });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }

  // Only an authenticated CEO can create an Admin account.
  // Unlike the old registration form, this NEVER signs in the new Admin.
  async function createAdminAccount(form) {
    try {
      if (!requireSuperAdmin()) return false;
      const result = await createAdminByCEO(admin.id, form);
      setNotice({ type: "success", text: `Admin account for ${result.account.name} created! ♡` });
      return result;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }

  async function resetAdminPassword(id) {
    try {
      if (!requireSuperAdmin()) return false;
      const result = await resetAdminPasswordByCEO(admin.id, id);
      setNotice({ type: "success", text: "New temporary password generated. Share it privately! ♡" });
      return result;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }

  // Reversible deactivation, instead of permanently deleting credentials.
  function deleteAdmin(id) {
    try {
      if (!requireSuperAdmin()) return false;
      removeAdminAccount(admin.id, id);
      setNotice({ type: "success", text: "Admin account deactivated. It can be reactivated in Settings! ♡" });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }

  function reactivateAdmin(id) {
    try {
      if (!requireSuperAdmin()) return false;
      reactivateAdminAccount(admin.id, id);
      setNotice({ type: "success", text: "Admin account reactivated! ♡" });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    }
  }

  function perform(action) {
    try {
      const next = clone(data);
      // Validation is complete before audit entries are created.
      // Only successfully modified records are logged.
      const message = action(next);
      const events = buildWorkspaceAuditEntries(data, next, admin);
      // Keep the audit history separate from workspace reset/Archives.
      // If logging fails, do not apply this workspace change silently.
      appendAuditEntries(events);
      setData(next);
      setNotice({ type: "success", text: message || "Changes saved successfully! ♡" });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message || "Unable to save changes." });
      return false;
    }
  }


  /* ===== RECENTLY DELETED / FHILAR ARCHIVES ===== */
  // Only business records live here. Authentication accounts have their own store.
  function archiveRecord(next, type, record, label, related = {}) {
    next.archives = Array.isArray(next.archives) ? next.archives : [];
    next.archives.push({
      id: newId("ARC"),
      type,
      record: clone(record),
      label,
      related: clone(related),
      deletedAt: new Date().toISOString(),
      deletedBy: admin?.id || null,
      deletedByName: admin?.name || "Administrator"
    });
  }

  // CEO-only: never restore data that conflicts with newer live records.
  function restoreArchive(archiveId) {
    if (!requireSuperAdmin()) return false;
    return perform(next => {
      const item = (next.archives || []).find(entry => entry.id === archiveId);
      if (!item) throw new Error("Archive entry not found.");
      const record = clone(item.record);
      const anyPayrollOn = date => next.runs.some(run => date >= run.start && date <= run.end);
      const employeeExists = id => next.employees.some(e => e.id === id);

      if (item.type === "attendance") {
        if (!employeeExists(record.employeeId)) {
          throw new Error("Restore the employee first; their profile no longer exists.");
        }
        if (next.attendance.some(a => a.id === record.id)) {
          throw new Error("This attendance ID already exists.");
        }
        if (record.payrollId) {
          throw new Error("Payroll-linked attendance cannot be individually restored.");
        }
        const day = lateForRecord(record, next.settings).scheduledDate || workDate(record);
        if (anyPayrollOn(day)) {
          throw new Error("This date is already part of a payroll run. Restore is blocked.");
        }
        checkNoAbsenceOrLeave(next, record);
        validateOverlap(next.attendance, record);
        next.attendance.push(record);
        const oldReview = item.related?.cutoffReview;
        if (oldReview && !(next.cutoffReviews || []).some(r => r.attendanceId === record.id)) {
          next.cutoffReviews.push(oldReview);
        }
      } else if (item.type === "absence") {
        if (!employeeExists(record.employeeId)) throw new Error("Employee no longer exists.");
        if (next.absences.some(a => a.id === record.id ||
          (a.employeeId === record.employeeId && a.date === record.date))) {
          throw new Error("An absence already exists for this employee/date.");
        }
        if (anyPayrollOn(record.date)) throw new Error("Date belongs to a payroll run.");
        if (attendanceForDay(next.attendance, record.employeeId, record.date, next.settings) ||
            approvedLeaveForDay(next.leaves, record.employeeId, record.date) ||
            pendingLeaveForDay(next.leaves, record.employeeId, record.date)) {
          throw new Error("Cannot restore: this day already has attendance or leave.");
        }
        next.absences.push(record);
      } else if (item.type === "leave") {
        if (!employeeExists(record.employeeId)) throw new Error("Employee no longer exists.");
        if (next.leaves.some(l => l.id === record.id)) throw new Error("Leave ID already exists.");
        if (record.status === "Approved") {
          throw new Error("Approved leave cannot be restored through the delete workflow.");
        }
        if (record.status === "Pending") {
          validateLeaveRequest(record, next);
          const conflictAttendance = next.attendance.some(a => {
            if (a.employeeId !== record.employeeId) return false;
            const day = lateForRecord(a, next.settings).scheduledDate || workDate(a);
            return day >= record.start && day <= record.end;
          });
          const conflictAbsence = next.absences.some(a =>
            a.employeeId === record.employeeId && a.date >= record.start && a.date <= record.end);
          if (conflictAttendance || conflictAbsence) {
            throw new Error("Resolve existing attendance/absences before restoring this pending leave.");
          }
        }
        next.leaves.push(record);
      } else if (item.type === "payroll") {
        if (record.status === "Paid") throw new Error("Paid payroll cannot be canceled or restored this way.");
        if (next.runs.some(run => run.id === record.id ||
          (record.start <= run.end && record.end >= run.start))) {
          throw new Error("This payroll period overlaps an existing run.");
        }
        const snapshots = record.lines.flatMap(line => line.attendance || []);
        if (!snapshots.length) throw new Error("Payroll snapshot has no attendance records.");
        for (const snapshot of snapshots) {
          const live = next.attendance.find(a => a.id === snapshot.id);
          if (!live || live.payrollId || live.status !== "Approved") {
            throw new Error("An original attendance record was changed, removed, or relocked.");
          }
          // A changed time, break, rate, night rule, or late snapshot
          // makes the old payroll totals stale, so don't relock it.
          for (const key of ["timeIn", "timeOut", "breakStart", "breakEnd", "rate", "shift", "rule", "late"]) {
            if (JSON.stringify(live[key] ?? null) !== JSON.stringify(snapshot[key] ?? null)) {
              throw new Error("The original attendance changed. Generate a new payroll instead.");
            }
          }
        }
        next.attendance.forEach(a => {
          if (snapshots.some(snapshot => snapshot.id === a.id)) a.payrollId = record.id;
        });
        record.status = "Draft";
        record.paymentReference = "";
        record.paymentDate = null;
        next.runs.push(record);
      } else if (item.type === "workspace") {
        if (next.employees.length || next.attendance.length || next.runs.length ||
            next.leaves.length || next.absences.length || next.cutoffReviews.length) {
          throw new Error("Workspace must be empty to restore a reset backup. Export or clear current work first.");
        }
        for (const key of ["settings", "employees", "attendance", "runs", "leaves", "absences", "cutoffReviews"]) {
          next[key] = clone(record[key]);
        }
      } else {
        throw new Error("Unsupported archive entry type.");
      }
      next.archives = next.archives.filter(entry => entry.id !== archiveId);
      return `Restored ${item.label} successfully! ♡`;
    });
  }

  function permanentlyDeleteArchive(archiveId) {
    if (!requireSuperAdmin()) return false;
    return perform(next => {
      const entry = (next.archives || []).find(item => item.id === archiveId);
      if (!entry) throw new Error("Archive entry not found.");
      next.archives = next.archives.filter(item => item.id !== archiveId);
      return "Permanently deleted from Archives. This cannot be undone.";
    });
  }

  /* ===== FHILAR LEAVE MANAGEMENT ACTIONS ===== */
function submitLeave(input) {
  return perform(next => {
    const leave = createLeaveRequest(
      input,
      next,
      admin
    );
    next.leaves = [
      ...(next.leaves || []),
      leave
    ];
    return "Leave request submitted for CEO approval! ♡";
  });
}
function reviewLeave(id, decision) {
  return perform(next => {
    if (admin?.role !== "super_admin") {
      throw new Error(
        "Only the Super Admin can review leave requests."
      );
    }
    const leave = (next.leaves || []).find(
      item => item.id === id
    );
    if (!leave || leave.status !== "Pending") {
      throw new Error(
        "Only pending leave requests can be reviewed."
      );
    }
    if (decision === "approve") {
      validateLeaveRequest(
        leave,
        next,
        leave.id
      );
      const conflictingAbsence = (next.absences || []).some(item =>
        item.employeeId === leave.employeeId &&
        item.date >= leave.start && item.date <= leave.end
      );
      if (conflictingAbsence) {
        throw new Error("Undo recorded absences within these leave dates before approval.");
      }
      const conflictingAttendance = next.attendance.some(item => {
        if (item.employeeId !== leave.employeeId) return false;
        const recordedDate = (item.late || calculateLate(item, next.settings)).scheduledDate;
        return recordedDate >= leave.start && recordedDate <= leave.end;
      });
      if (conflictingAttendance) {
        throw new Error("Employee has existing attendance within this leave. Resolve it first.");
      }
      leave.status = "Approved";
    } else if (decision === "reject") {
      leave.status = "Rejected";
    } else {
      throw new Error("Invalid leave review action.");
    }
    leave.reviewedAt = new Date().toISOString();
    leave.reviewedBy = admin.id;
    return `Leave request ${leave.status.toLowerCase()}! ♡`;
  });
}
function withdrawLeave(id) {
  return perform(next => {
    const leave = (next.leaves || []).find(
      item => item.id === id
    );
    if (!leave) {
      throw new Error("Leave request not found.");
    }
    if (leave.status === "Approved") {
      throw new Error(
        "Approved leave cannot be removed without a formal reversal process."
      );
    }
    if (
      admin?.role !== "super_admin" &&
      leave.submittedBy !== admin?.id
    ) {
      throw new Error(
        "You can only remove your own pending or rejected requests."
      );
    }
    archiveRecord(next, "leave", leave,
      `${leave.type} · ${next.employees.find(e => e.id === leave.employeeId)?.name || leave.employeeId}`);
    next.leaves = next.leaves.filter(item => item.id !== id);
    return "Leave request moved to Archives. ♡";
  });
}
  /* ===== ABSENCE & LATE-ARRIVAL TRACKING ===== */
  function checkNoAbsenceOrLeave(next, record) {
    const scheduledDate = calculateLate(record, next.settings).scheduledDate;
    if (!scheduledDate) throw new Error("Unable to determine scheduled work date.");
    if ((next.absences || []).some(item =>
      item.employeeId === record.employeeId && item.date === scheduledDate
    )) {
      throw new Error("This date was marked Absent. Undo the absence first.");
    }
    const leave = approvedLeaveForDay(next.leaves, record.employeeId, scheduledDate) ||
      pendingLeaveForDay(next.leaves, record.employeeId, scheduledDate);
    if (leave) throw new Error("This date has a leave request. Resolve the leave first.");
  }

  function recordAbsence(employeeId, date, reason = "") {
    return perform(next => {
      if (!isScheduledWeekday(date)) {
        throw new Error("The demo treats Monday to Friday as scheduled working days.");
      }
      if (!date || date >= phDate()) {
        throw new Error("Only past scheduled workdays may be marked Absent.");
      }
      const employee = next.employees.find(e => e.id === employeeId && e.active);
      if (!employee) throw new Error("Select an active employee.");
      if (String(reason).trim().length > 160) throw new Error("Reason must be 160 characters or less.");
      if (next.runs.some(run => date >= run.start && date <= run.end)) {
        throw new Error("Cannot edit absence for a period already in a payroll run.");
      }
      if (attendanceForDay(next.attendance, employeeId, date, next.settings)) {
        throw new Error("This employee already has recorded attendance for that date.");
      }
      if (approvedLeaveForDay(next.leaves, employeeId, date) ||
          pendingLeaveForDay(next.leaves, employeeId, date)) {
        throw new Error("Employee has a leave request on this date. Review it first.");
      }
      if ((next.absences || []).some(item => item.employeeId === employeeId && item.date === date)) {
        throw new Error("Absence is already recorded.");
      }
      next.absences = next.absences || [];
      next.absences.push({
        id: newId("ABS"), employeeId, date,
        reason: String(reason).trim(), recordedBy: admin?.id || null,
        recordedAt: new Date().toISOString()
      });
      return `${employee.name} marked Absent for ${date}. ♡`;
    });
  }

  function removeAbsence(id) {
    return perform(next => {
      const absence = (next.absences || []).find(item => item.id === id);
      if (!absence) throw new Error("Absence not found.");
      if (next.runs.some(run => absence.date >= run.start && absence.date <= run.end)) {
        throw new Error("This date belongs to an existing payroll run.");
      }
      archiveRecord(next, "absence", absence,
        `Absence · ${next.employees.find(e => e.id === absence.employeeId)?.name || absence.employeeId} · ${absence.date}`);
      next.absences = next.absences.filter(item => item.id !== id);
      return "Absence moved to Archives. ♡";
    });
  }

  /* ===== CEO 60-MINUTE CUTOFF REVIEWS ===== */
  // Reviews are separate from attendance and payroll snapshots.
  function findFlaggedAttendance(next, attendanceId) {
    const record = next.attendance.find(a => a.id === attendanceId);
    if (!record) throw new Error("Attendance record not found.");
    const late = lateForRecord(record, next.settings);
    if (late.minutesLate < 60) {
      throw new Error("Only arrivals 60 minutes or more late require a cutoff review.");
    }
    return record;
  }

  function submitCutoffExplanation(attendanceId, explanation) {
    return perform(next => {
      const record = findFlaggedAttendance(next, attendanceId);
      const note = String(explanation || "").trim();
      if (!note || note.length > 300) {
        throw new Error("Provide an explanation of up to 300 characters.");
      }
      next.cutoffReviews = next.cutoffReviews || [];
      let review = next.cutoffReviews.find(r => r.attendanceId === attendanceId);
      if (review && review.status !== "Pending") {
        throw new Error("The CEO has already decided this review. Ask the CEO to reopen it first.");
      }
      if (!review) {
        review = {
          attendanceId, employeeId: record.employeeId, status: "Pending",
          explanation: "", history: []
        };
        next.cutoffReviews.push(review);
      }
      review.explanation = note;
      review.explanationBy = admin?.id || null;
      review.explanationByName = admin?.name || "Administrator";
      review.explanationAt = new Date().toISOString();
      review.history = review.history || [];
      review.history.push({ action: "Explanation submitted", at: review.explanationAt, by: admin?.id || null });
      return "Cutoff explanation sent for CEO review! ♡";
    });
  }

  function decideCutoffReview(attendanceId, decision, note = "") {
    if (!requireSuperAdmin()) return false;
    return perform(next => {
      const record = findFlaggedAttendance(next, attendanceId);
      if (!["Excused", "Confirmed"].includes(decision)) {
        throw new Error("Invalid cutoff review decision.");
      }
      const reason = String(note || "").trim();
      if (reason.length > 300 || (decision === "Confirmed" && !reason)) {
        throw new Error("Provide a CEO reason (maximum 300 characters) for confirming a violation.");
      }
      next.cutoffReviews = next.cutoffReviews || [];
      let review = next.cutoffReviews.find(r => r.attendanceId === attendanceId);
      if (!review) {
        review = { attendanceId, employeeId: record.employeeId, status: "Pending", explanation: "", history: [] };
        next.cutoffReviews.push(review);
      }
      if (review.status !== "Pending") {
        throw new Error("This cutoff was already reviewed. Reopen it to change the decision.");
      }
      review.status = decision;
      review.decisionNote = reason;
      review.reviewedBy = admin.id;
      review.reviewedByName = admin.name;
      review.reviewedAt = new Date().toISOString();
      review.history = review.history || [];
      review.history.push({ action: decision, at: review.reviewedAt, by: admin.id, note: reason });
      return decision === "Excused"
        ? "Late cutoff marked Excused by the CEO! ♡"
        : "Late cutoff violation confirmed by the CEO. Review saved! ♡";
    });
  }

  function reopenCutoffReview(attendanceId, note) {
    if (!requireSuperAdmin()) return false;
    return perform(next => {
      findFlaggedAttendance(next, attendanceId);
      const reason = String(note || "").trim();
      if (!reason || reason.length > 300) {
        throw new Error("Provide a reason for reopening (maximum 300 characters).");
      }
      const review = (next.cutoffReviews || []).find(r => r.attendanceId === attendanceId);
      if (!review || review.status === "Pending") {
        throw new Error("This review is already pending.");
      }
      review.history = review.history || [];
      review.history.push({ action: "Reopened", from: review.status, by: admin.id, at: new Date().toISOString(), note: reason });
      review.status = "Pending";
      review.decisionNote = "";
      review.reviewedBy = null;
      review.reviewedByName = null;
      review.reviewedAt = null;
      return "Cutoff review reopened for another CEO decision. ♡";
    });
  }

  function employeeSave(input, editing = false) {
    return perform(next => {
      const id = String(input.id || "").trim().toUpperCase();
      const name = String(input.name || "").trim();
      const position = String(input.position || "").trim();
      const department = String(input.department || "").trim();
      if (!id || !name || !position || !department) throw new Error("Complete all required employee fields.");
      if (!next.settings.shifts[input.shift]) throw new Error("Select a valid shift.");
      const customRate = input.customRate === "" || input.customRate == null ? null : Number(input.customRate);
      if (customRate !== null && (!Number.isFinite(customRate) || customRate <= 0)) {
        throw new Error("Custom rate must be greater than zero.");
      }
      if (editing) {
        const employee = next.employees.find(e => e.id === id);
        if (!employee) throw new Error("Employee not found.");
        if (!input.active && next.attendance.some(a => a.employeeId === id && !a.timeOut)) {
          throw new Error("Clock out this employee before deactivation.");
        }
        Object.assign(employee, { name, position, department, shift: input.shift, customRate, active: Boolean(input.active) });
      } else {
        if (next.employees.some(e => e.id === id)) throw new Error("Employee ID already exists.");
        next.employees.push({ id, name, position, department, shift: input.shift, customRate, active: true });
      }
      return editing ? "Employee updated! ♡" : "New employee added! ♡";
    });
  }
  function employeeDeactivate(id) {
    return perform(next => {
      const employee = next.employees.find(e => e.id === id);
      if (!employee) throw new Error("Employee not found.");
      if (next.attendance.some(a => a.employeeId === id && !a.timeOut)) {
        throw new Error("Clock out this employee before deactivation.");
      }
      employee.active = false;
      return "Employee deactivated; existing history is retained.";
    });
  }
  function validateOverlap(records, candidate, ignoreId = null) {
    const start = Date.parse(candidate.timeIn);
    const end = candidate.timeOut ? Date.parse(candidate.timeOut) : Infinity;
    const collision = records.some(record => {
      if (record.id === ignoreId || record.employeeId !== candidate.employeeId) return false;
      const oldStart = Date.parse(record.timeIn);
      const oldEnd = record.timeOut ? Date.parse(record.timeOut) : Infinity;
      return start < oldEnd && oldStart < end;
    });
    if (collision) throw new Error("Attendance overlaps another recorded shift for this employee.");
  }
  function clockIn(employeeId) {
    return perform(next => {
      const employee = next.employees.find(e => e.id === employeeId && e.active);
      if (!employee) throw new Error("Select an active employee.");
      if (next.attendance.some(a => a.employeeId === employeeId && !a.timeOut)) {
        throw new Error("Employee is already clocked in.");
      }
      const recent = [...next.attendance]
        .filter(a => a.employeeId === employeeId)
        .sort((a, b) => Date.parse(b.timeIn) - Date.parse(a.timeIn))[0];
      if (recent?.entryMethod === "clock" && recent.status === "Draft" &&
          !recent.payrollId && Date.now() - Date.parse(recent.timeIn) < 24 * 60 * 60000) {
        throw new Error("This employee has a recent Draft clock-out. Update Time Out if needed or approve the record first.");
      }
      const record = { id: newId("ATT"), employeeId, shift: employee.shift, shiftLabel: getShiftLabel(employee, next.settings),
        timeIn: new Date().toISOString(), timeOut: null, breakStart: null, breakEnd: null,
        rate: getRate(employee, next.settings), rule: createRule(next.settings),
        entryMethod: "clock", createdBy: admin?.id || null,
        status: "Open", payrollId: null };
      record.late = calculateLate(record, next.settings);
      checkNoAbsenceOrLeave(next, record);
      validateOverlap(next.attendance, record);
      next.attendance.push(record);
      return `${employee.name} clocked in successfully!`;
    });
  }
  function clockOut(employeeId) {
    return perform(next => {
      const latest = next.attendance
        .filter(a => a.employeeId === employeeId)
        .sort((a, b) => Date.parse(b.timeIn) - Date.parse(a.timeIn))[0];

      if (!latest) {
        throw new Error("No recent time-in record found for this employee.");
      }

      const now = Date.now();
      const startedAt = Date.parse(latest.timeIn);
      if (!Number.isFinite(startedAt) || startedAt > now) {
        throw new Error("Invalid or future time-in record.");
      }
      if (now - startedAt < 60000) {
        throw new Error("Please wait at least one minute after Time In.");
      }
      if (now - startedAt > 24 * 60 * 60000) {
        throw new Error("Time-out corrections older than 24 hours require Super Admin review.");
      }

      // First time-out from the live clock: no manual date/time input.
      if (!latest.timeOut) {
        if (latest.status !== "Open" || latest.payrollId) {
          throw new Error("This attendance is no longer open for Time Out.");
        }
        latest.timeOut = new Date(now).toISOString();
        latest.late = calculateLate(latest, next.settings);
        calculatePay(latest);
        latest.status = "Draft";
        return "Time Out saved! If it was too early, click Update Time Out before approval. ♡";
      }

      // An accidental early Time Out can be replaced by clicking the button again.
      // This is only permitted for a still-unapproved live-clock record.
      if (latest.entryMethod !== "clock" ||
          latest.status !== "Draft" || latest.payrollId) {
        throw new Error("This time-out is already approved, locked, or manual. Only Super Admin can edit it.");
      }

      const oldTimeOut = Date.parse(latest.timeOut);
      if (!Number.isFinite(oldTimeOut) || now <= oldTimeOut) {
        throw new Error("The new Time Out must be later than the previous Time Out.");
      }

      const previous = latest.timeOut;
      latest.timeOut = new Date(now).toISOString();
      latest.late = calculateLate(latest, next.settings);
      calculatePay(latest);
      latest.timeOutCorrections = [
        ...(latest.timeOutCorrections || []),
        {
          previousTimeOut: previous,
          newTimeOut: latest.timeOut,
          updatedBy: admin?.id || null,
          updatedAt: latest.timeOut
        }
      ];

      return "Time Out updated to the current PH time. Correction saved in history! ♡";
    });
  }

  function attendanceSave(input, editId = null) {
    return perform(next => {
      // Hiding Edit in the UI is not enough: enforce the role in the action too.
      if (editId && admin?.role !== "super_admin") {
        throw new Error("Only the Super Admin can edit existing attendance.");
      }

      const employee = next.employees.find(e => e.id === input.employeeId);
      if (!employee) throw new Error("Employee not found.");
      if (!employee.active && !editId) throw new Error("Select an active employee.");
      const old = editId ? next.attendance.find(a => a.id === editId) : null;
      if (editId && !old) throw new Error("Attendance not found.");
      if (old?.payrollId) throw new Error("This record is locked in a payroll run.");
      const timeIn = localInputToISO(input.timeIn);
      const timeOut = localInputToISO(input.timeOut);
      const currentTime = Date.now();
      if (Date.parse(timeIn) > currentTime || Date.parse(timeOut) > currentTime) {
        throw new Error("Advance/future attendance is not allowed. Record only time already worked.");
      }

      const record = {
        id: editId || newId("ATT"),
        employeeId: employee.id,
        shift: old ? old.shift : employee.shift,
        shiftLabel: old
          ? (old.shiftLabel || getShiftLabel({ shift: old.shift }, next.settings))
          : getShiftLabel(employee, next.settings),
        timeIn,
        timeOut,
        breakStart: input.breakStart ? localInputToISO(input.breakStart) : null,
        breakEnd: input.breakEnd ? localInputToISO(input.breakEnd) : null,
        rate: old ? old.rate : getRate(employee, next.settings),
        rule: old ? old.rule : createRule(next.settings),
        status: "Draft",
        payrollId: null,
        entryMethod: editId ? "ceo_edit" : "manual",
        createdBy: old?.createdBy || admin?.id || null,
        timeOutCorrections: old?.timeOutCorrections || [],
        editHistory: [
          ...(old?.editHistory || []),
          ...(editId ? [{
            editedAt: new Date().toISOString(),
            editedBy: admin?.id || null,
            previousTimeIn: old.timeIn,
            previousTimeOut: old.timeOut,
            newTimeIn: timeIn,
            newTimeOut: timeOut
          }] : [])
        ]
      };

      record.late = calculateLate(record, next.settings);
      checkNoAbsenceOrLeave(next, record);
      calculatePay(record);
      validateOverlap(next.attendance, record, editId);
      if (editId) {
        next.attendance = next.attendance.map(a => a.id === editId ? record : a);
      } else {
        next.attendance.push(record);
      }
      return editId
        ? "Attendance corrected by Super Admin and returned to Draft for approval. ♡"
        : "Attendance saved for approval. No future entries allowed. ♡";
    });
  }

  function deleteAttendance(id) {
    return perform(next => {
      if (admin?.role !== "super_admin") {
        throw new Error("Only the Super Admin can delete attendance.");
      }
      const record = next.attendance.find(a => a.id === id);
      if (!record) throw new Error("Attendance record not found.");
      if (record.payrollId) throw new Error("This record belongs to payroll and cannot be deleted.");
      const cutoffReview = next.cutoffReviews.find(r => r.attendanceId === id) || null;
      archiveRecord(next, "attendance", record,
        `Attendance · ${next.employees.find(e => e.id === record.employeeId)?.name || record.employeeId} · ${phDate(new Date(record.timeIn))}`,
        { cutoffReview });
      next.attendance = next.attendance.filter(a => a.id !== id);
      next.cutoffReviews = next.cutoffReviews.filter(r => r.attendanceId !== id);
      return "Attendance moved to Archives. You can restore it there! ♡";
    });
  }
  function returnAttendanceToDraft(id) {
    return perform(next => {
      if (admin?.role !== "super_admin") {
        throw new Error("Only the Super Admin can reopen approved attendance.");
      }
      const record = next.attendance.find(a => a.id === id);
      if (!record || record.status !== "Approved" || record.payrollId) {
        throw new Error("Only unlocked approved attendance can be returned for editing.");
      }
      record.status = "Draft";
      return "Attendance returned to Draft for review.";
    });
  }
  function approveAttendance(id) {
    return perform(next => {
      const record = next.attendance.find(a => a.id === id);
      if (!record || !record.timeOut || record.status !== "Draft") {
        throw new Error("Only completed Draft attendance can be approved.");
      }
      if (record.payrollId) throw new Error("Attendance is locked in payroll.");
      calculatePay(record);
      record.late = calculateLate(record, next.settings);
      record.status = "Approved";
      return "Attendance approved! ♡";
    });
  }
  function createPayroll(start, end) {
    return perform(next => {
      if (!start || !end || start > end) throw new Error("Choose a valid payroll period.");
      if (end > phDate()) throw new Error("Payroll period cannot end in the future.");
      if (next.runs.some(run => start <= run.end && end >= run.start)) {
        throw new Error("This period overlaps an existing payroll run.");
      }
      const records = next.attendance.filter(a => {
        const date = (a.late || calculateLate(a, next.settings)).scheduledDate || workDate(a);
        return date >= start && date <= end;
      });
      if (!records.length) throw new Error("No attendance exists in this period.");
      if (records.some(a => !a.timeOut || a.status !== "Approved" || a.payrollId)) {
        throw new Error("Complete and approve all attendance in this period first.");
      }
      const lines = createPayrollLines(next.employees, records).map(line => {
        const demoLateTotal = roundMoney(line.attendance.reduce((sum, item) => {
          const info = item.late || calculateLate(item, next.settings);
          return sum + Number(info.deduction || 0);
        }, 0));
        const lateDeduction = Math.min(line.gross, demoLateTotal);
        return {
          ...line, extraPay: 0, extraNote: "",
          lateDeduction,
          otherDeduction: 0,
          otherDeductionNote: "",
          deduction: lateDeduction,
          deductionNote: lateDeduction > 0
            ? "Classroom demo late adjustment (scheduled daily pay brackets)" : "",
          net: roundMoney(line.gross - lateDeduction)
        };
      });
      const id = newId("PR");
      next.runs.push({ id, start, end, status: "Draft", createdAt: new Date().toISOString(),
        lines, paymentReference: "", paymentDate: null });
      records.forEach(a => { a.payrollId = id; });
      return "Payroll draft created! ♡";
    });
  }
  function payrollAction(id, action, reference = "") {
// Payroll final approval is reserved for the CEO.
const runStatus = data.runs.find(
  run => run.id === id
)?.status;
const requiresCEO =
  ["approve", "pay", "return"].includes(action) ||
  (
    action === "cancel" &&
    runStatus !== "Draft"
  );
if (requiresCEO && !requireSuperAdmin()) {
  return false;
}
    return perform(next => {
      const run = next.runs.find(r => r.id === id);
      if (!run) throw new Error("Payroll run not found.");
      if (action === "return") {
        if (!(["Pending approval", "Approved"].includes(run.status))) {
          throw new Error("Only unpaid submitted or approved payroll can return to Draft.");
        }
        run.status = "Draft";
        return "Payroll returned to Draft for corrections.";
      }
      if (action === "cancel") {
        if (run.status === "Paid") throw new Error("Paid payroll cannot be cancelled.");
        archiveRecord(next, "payroll", run, `Payroll ${run.id} · ${run.start} to ${run.end}`);
        next.attendance.forEach(a => { if (a.payrollId === id) a.payrollId = null; });
        next.runs = next.runs.filter(r => r.id !== id);
        return "Payroll canceled and moved to Archives; attendance unlocked. ♡";
      }
      const transitions = { submit: ["Draft", "Pending approval"],
        approve: ["Pending approval", "Approved"], pay: ["Approved", "Paid"] };
      const t = transitions[action];
      if (!t || run.status !== t[0]) throw new Error("Invalid payroll status transition.");
      if (action === "pay") {
        if (!String(reference || "").trim()) throw new Error("Payment reference is required.");
        run.paymentReference = reference.trim();
        run.paymentDate = phDate();
      }
      run.status = t[1];
      return `Payroll status updated to ${run.status}.`;
    });
  }
  function adjustPayrollLine(runId, employeeId, input) {
    return perform(next => {
      const run = next.runs.find(r => r.id === runId);
      if (!run || run.status !== "Draft") {
        throw new Error("Only a draft payroll can be adjusted.");
      }
      const line = run.lines.find(l => l.employeeId === employeeId);
      if (!line) throw new Error("Employee payroll line not found.");
      const extra = Number(input.extraPay);
      const other = Number(input.otherDeduction);
      const frozenLate = Number(line.lateDeduction || 0);
      if (![extra, other].every(n => Number.isFinite(n) && n >= 0)) {
        throw new Error("Amounts must be zero or greater.");
      }
      if (extra > 0 && !String(input.extraNote || "").trim()) {
        throw new Error("Provide a reason for extra earnings.");
      }
      if (other > 0 && !String(input.otherDeductionNote || "").trim()) {
        throw new Error("Provide a reason for the additional deduction.");
      }
      const gross = roundMoney(line.basePay + line.nightPay + extra);
      const deduction = roundMoney(frozenLate + other);
      if (deduction > gross) {
        throw new Error("Deductions cannot exceed gross pay.");
      }
      line.extraPay = roundMoney(extra);
      line.otherDeduction = roundMoney(other);
      line.lateDeduction = roundMoney(frozenLate);
      line.deduction = deduction;
      line.extraNote = String(input.extraNote || "").trim();
      line.otherDeductionNote = String(input.otherDeductionNote || "").trim();
      line.deductionNote = [
        frozenLate > 0 ? "Classroom demo late adjustment" : "",
        other > 0 ? line.otherDeductionNote : ""
      ].filter(Boolean).join("; ");
      line.gross = gross;
      line.net = roundMoney(gross - deduction);
      return "Payroll adjustment saved to the draft.";
    });
  }
  function updateSettings(settings) {
if (!requireSuperAdmin()) return false;
    return perform(next => {
      const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!String(settings.company || "").trim()) throw new Error("Company name is required.");
      const percent = Number(settings.nightPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error("Night differential must be between 0% and 100%.");
      }
      if (!validTime.test(settings.nightStart) || !validTime.test(settings.nightEnd) ||
          settings.nightStart === settings.nightEnd) throw new Error("Invalid night differential time window.");
      if (!settings.shifts || Object.keys(settings.shifts).length !== Object.keys(next.settings.shifts).length) {
        throw new Error("All shift schedules must be configured.");
      }
      Object.values(settings.shifts).forEach(shift => {
        if (!shift || !validTime.test(shift.start) || !validTime.test(shift.end) ||
            shift.start === shift.end || !Number.isFinite(Number(shift.rate)) || Number(shift.rate) <= 0) {
          throw new Error("Set valid shift times and a rate greater than zero.");
        }
      });
      next.settings = { ...settings, company: settings.company.trim(), nightPercent: percent,
        shifts: Object.fromEntries(Object.entries(settings.shifts).map(([key, value]) =>
          [key, { ...value, rate: Number(value.rate) }])) };
      return "Settings saved; existing attendance and payroll snapshots are unchanged.";
    });
  }
  function resetDemo() {
if (!requireSuperAdmin()) return false;
    const next = withLeaveData(createInitialData());
    next.archives = [...(data.archives || [])];
    const hasRecords = data.employees.length || data.attendance.length || data.runs.length ||
      data.leaves.length || data.absences.length || data.cutoffReviews.length;
    if (hasRecords) {
      archiveRecord(next, "workspace", {
        settings: data.settings,
        employees: data.employees,
        attendance: data.attendance,
        leaves: data.leaves,
        absences: data.absences,
        cutoffReviews: data.cutoffReviews,
        runs: data.runs
      }, `Workspace backup before reset · ${phDate()}`);
    }
    try {
      appendAuditEvent({
        actor: admin,
        module: "Workspace",
        action: "Reset Workspace",
        recordId: "FHILAR-WORKSPACE",
        subject: "Shared FHILAR company workspace",
        changes: [
          { field: "Employees", before: data.employees.length, after: 0 },
          { field: "Attendance Records", before: data.attendance.length, after: 0 },
          { field: "Payroll Runs", before: data.runs.length, after: 0 },
          { field: "Leave Requests", before: data.leaves.length, after: 0 }
        ],
        reason: "CEO workspace reset; backup retained in Archives if records existed"
      });
    } catch (error) {
      setNotice({ type: "error", text: `Reset canceled: ${error.message}` });
      return false;
    }
    setData(next);
    setPage("dashboard");
    setNotice({ type: "success", text: "Workspace reset. The previous records were archived for CEO recovery. ♡" });
  }
if (signingOut) {
  return (
    <div
      className="fhilar-logout-screen"
      role="status"
      aria-live="polite"
    >
      <div className="fhilar-logout-banner">
        <span className="logout-flower">✿</span>
        <img
          src="/fhilar-logo.png"
          alt="FHILAR Apparel"
          className="logout-logo"
        />
        <span className="eyebrow">
          THE WORKPLACE STUDIO
        </span>
        <h2>Signing you out, Bestie!</h2>
        <p>
          Thank you for making today a lovely day.
          <br />
          See you again soon! ♡
        </p>
        <div className="logout-progress">
          <span />
        </div>
      </div>
    </div>
  );
}
  if (!admin) {
    return <Login onLogin={handleLogin} />;
  }
  // New/reset Admins cannot access any FHILAR data or pages until they
  // replace the temporary password. This check applies after page refresh too.
  if (admin.mustChangePassword) {
    return (
      <FirstLoginPasswordChange
        admin={admin}
        onSave={saveAdminPassword}
        onLogout={handleLogout}
      />
    );
  }
const props = {
  data,
  admin,
  setPage,
  employeeSave,
  employeeDeactivate,
  submitLeave,
  reviewLeave,
  withdrawLeave,
  clockIn,
  clockOut,
  attendanceSave,
  approveAttendance,
  deleteAttendance,
  returnAttendanceToDraft,
  recordAbsence,
  removeAbsence,
  submitCutoffExplanation,
  decideCutoffReview,
  reopenCutoffReview,
  createPayroll,
  payrollAction,
  adjustPayrollLine,
  updateSettings,
  resetDemo,
  saveAdminProfile,
  saveAdminPassword,
  listAdmins,
  createAdminAccount,
  resetAdminPassword,
  deleteAdmin,
  reactivateAdmin,
  restoreArchive,
  permanentlyDeleteArchive
};
const pages = {
  dashboard: <Dashboard {...props} />,
  employees: <Employees {...props} />,
  attendance: <Attendance {...props} />,
  payroll: <Payroll {...props} />,
  reports: <Reports {...props} />,
  leaves: <Leaves {...props} />,
  settings: <Settings {...props} />,
  archives: <Archives {...props} />
};
// CEO-only page
if (isSuperAdmin) {
  pages.ceo = <CEOOverview {...props} />;
  pages.activityLogs = <ActivityLogs admin={admin} />;
}
  return <div className="app-shell">
<Sidebar
  page={page}
  setPage={setPage}
  onLogout={handleLogout}
  admin={admin}
/>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-breadcrumb"><span className="eyebrow">FHILAR / THE WORKPLACE STUDIO</span><h2>{titles[page]}</h2></div>
        <div className="topbar-profile"><span className="online-dot" /><div><strong>{admin.name}</strong>
<small>
  {isSuperAdmin
    ? "Super Administrator · CEO"
    : "Administrator"}
</small>
</div><div className="profile-avatar">{admin.name.charAt(0).toUpperCase()}</div>
          <button className="btn btn-outline topbar-signout" onClick={handleLogout}>Sign Out ↗</button></div>
      </header>
      <div className="main-content">
        <div className="demo-ribbon"><span>✧</span> FHILAR APPAREL <span className="ribbon-divider">·</span> Behind every pretty piece is a hardworking heart</div>
{notice && (
  <div
    key={`${notice.type}-${notice.text}`}
    className={`notice ${notice.type} fhilar-toast`}
    role={notice.type === "error" ? "alert" : "status"}
  >
    <span className="toast-icon">
      {notice.type === "error" ? "!" : "✿"}
    </span>
    <span className="toast-content">
      <strong>
        {notice.type === "error"
          ? "Oops, Bestie!"
          : "Hey there, Bestie! ♡"}
      </strong>
      <small>{notice.text}</small>
    </span>
  </div>
)}
        {pages[page]}
      </div>
      <footer className="app-footer"><span>FHILAR APPAREL · ATTENDANCE & PAYROLL</span><span>Thoughtfully made for the team ♡</span></footer>
    </main>
  </div>;
}

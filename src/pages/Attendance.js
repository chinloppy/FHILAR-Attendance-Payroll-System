
import React, { useState } from "react";
import Pagination, { usePagination } from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CutoffReviews from "../components/CutoffReviews";
import {
  money, calculatePay, phDateTime, phDate, workDate,
  displayDateTime, getShiftLabel
} from "../utils/payroll";
import {
  LATE_BRACKETS, lateForRecord, monitorDay,
  previousWorkingDate, isScheduledWeekday
} from "../utils/attendanceRules";

const empty = { employeeId: "", timeIn: "", timeOut: "", breakStart: "", breakEnd: "" };
const inputValue = iso => iso ? phDateTime(new Date(iso)) : "";

export default function Attendance({
  data, clockIn, clockOut, attendanceSave, approveAttendance,
  deleteAttendance, returnAttendanceToDraft, recordAbsence, removeAbsence,
  admin, submitCutoffExplanation, decideCutoffReview, reopenCutoffReview
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [monitorDate, setMonitorDate] = useState(previousWorkingDate());
  const [absenceForm, setAbsenceForm] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);

  const active = data.employees.filter(e => e.active);
  const isCEO = admin?.role === "super_admin";
  const latestClock = [...data.attendance]
    .filter(a => a.employeeId === employeeId)
    .sort((a, b) => Date.parse(b.timeIn) - Date.parse(a.timeIn))[0];
  const current = latestClock && !latestClock.timeOut ? latestClock : null;
  const hasDraftClockOut = Boolean(
    latestClock?.timeOut &&
    latestClock.entryMethod === "clock" &&
    latestClock.status === "Draft" &&
    !latestClock.payrollId &&
    Date.now() - Date.parse(latestClock.timeIn) < 24 * 60 * 60000
  );
  const canUpdateTimeOut = hasDraftClockOut;
  const nameOf = id => data.employees.find(e => e.id === id)?.name || id;
  const cutoffStatus = id => (data.cutoffReviews || []).find(r => r.attendanceId === id)?.status || "Pending";
  const records = [...data.attendance]
    .sort((a, b) => Date.parse(b.timeIn) - Date.parse(a.timeIn))
    .filter(a =>
      `${a.employeeId} ${nameOf(a.employeeId)}`.toLowerCase().includes(search.toLowerCase()) &&
      (!date || (lateForRecord(a, data.settings).scheduledDate || workDate(a)) === date) &&
      (statusFilter === "all" || a.status === statusFilter)
    );

  const daily = active.map(employee => ({
    employee,
    result: monitorDay(employee, monitorDate, data)
  }));
  const absentCount = daily.filter(row => row.result.type === "Absent").length;
  const missingCount = daily.filter(row => row.result.type === "Missing Record").length;
  const lateCount = daily.filter(row => row.result.type === "Late").length;
  const cutoffCount = daily.filter(row => row.result.type === "Cutoff Flag").length;

  const attendancePage = usePagination(records);
  const dailyPage = usePagination(daily);

  function openNew() {
    setEditId(null);
    setForm({ ...empty, employeeId, timeIn: phDateTime() });
  }
  function openEdit(record) {
    if (!isCEO) return;
    setEditId(record.id);
    setForm({
      employeeId: record.employeeId, timeIn: inputValue(record.timeIn),
      timeOut: inputValue(record.timeOut), breakStart: inputValue(record.breakStart),
      breakEnd: inputValue(record.breakEnd)
    });
  }
  function submit(event) {
    event.preventDefault();
    if (attendanceSave(form, editId)) setForm(null);
  }
  function submitAbsence(event) {
    event.preventDefault();
    if (recordAbsence(absenceForm.employeeId, monitorDate, absenceForm.reason)) {
      setAbsenceForm(null);
    }
  }

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">EVERY HOUR MATTERS</span>
          <h1>Attendance Studio <span>✿</span></h1>
          <p>Clock in, clock out, and track late arrivals and absences.</p>
        </div>
        <span className="pill">PH TIME · {phDate()}</span>
      </div>

      {}
      <div className="dashboard-columns">
        <section className="panel clock-panel">
          <span className="eyebrow">THE TIME CLOCK</span>
          <h2>Clock in, clock out. ♡</h2>
          <p>Choose an employee to record today's attendance.</p>
          <label>Employee
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">Choose employee</option>
              {active.map(e => (
                <option key={e.id} value={e.id}>{e.name} · {e.id}</option>
              ))}
            </select>
          </label>
          <div className="clock-status">
            <span className={`status ${current ? "green" : "gray"}`}>
              {current ? "Currently Clocked In" : hasDraftClockOut ? "Clocked Out · Draft" : "Not Clocked In"}
            </span>
            {current && <small>Since {displayDateTime(current.timeIn)}</small>}
            {!current && hasDraftClockOut && (
              <small>Last Time Out: {displayDateTime(latestClock.timeOut)} · Update available</small>
            )}
          </div>
          <div className="clock-buttons">
            <button className="btn btn-primary"
              disabled={!employeeId || Boolean(current) || hasDraftClockOut}
              onClick={() => clockIn(employeeId)}>◷ Time In</button>
            <button className="btn btn-outline" disabled={!current && !canUpdateTimeOut}
              onClick={() => clockOut(employeeId)}>
              {current ? "◷ Time Out" : "↻ Update Time Out"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            Live clock uses this device's PH time. If Time Out was accidental, click
            Update Time Out while the record is still Draft. Future attendance is blocked.
          </p>
        </section>
        <section className="panel soft-panel">
          <span className="eyebrow">ADMIN CORNER</span>
          <h3>Every minute counts.</h3>
          <p>Review attendance, late arrivals and missing workdays before payroll.</p>
          <div className="payday-decoration" aria-hidden="true">◷ ✿ ♡</div>
          <strong>{data.attendance.filter(a => a.status === "Draft").length} records awaiting approval</strong>
        </section>
      </div>

      {}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DAILY ATTENDANCE REVIEW</span>
            <h3>Who's in, late, or absent? ♡</h3>
          </div>
          <label>Review work date
            <input type="date" value={monitorDate} max={phDate()}
              onChange={e => { setMonitorDate(e.target.value); dailyPage.resetPage(); }} />
          </label>
        </div>
        <div className="fhilar-attendance-stats">
          <div><strong>{lateCount}</strong><span>Late</span></div>
          <div><strong>{cutoffCount}</strong><span>60-min cutoff flags</span></div>
          <div><strong>{absentCount}</strong><span>Recorded absent</span></div>
          <div><strong>{missingCount}</strong><span>Missing records</span></div>
        </div>

<p className="muted" style={{ marginTop: 13 }}>
  Attendance records are monitored based on assigned
  work schedules. Missing attendance may be reviewed
  and marked as absent, while approved leave is
  recorded separately. Employees arriving 60 minutes
  or more after their scheduled time are flagged
  for further review.
</p>

        <div className="table-scroll">
          <table>
            <thead><tr><th>EMPLOYEE</th><th>WORK DATE</th><th>MONITOR STATUS</th><th>DETAIL</th><th>ACTION</th></tr></thead>
            <tbody>
              {dailyPage.pageItems.map(({ employee, result }) => (
                <tr key={employee.id}>
                  <td><strong>{employee.name}</strong><div className="muted">{employee.id}</div></td>
                  <td>{monitorDate}</td>
                  <td>
                    <span className={`fhilar-monitor-pill ${
                      result.type === "Absent" || result.type === "Cutoff Flag" ? "danger" :
                      result.type === "Late" || result.type === "Missing Record" ? "warning" :
                      result.type === "Approved Leave" || result.type === "Present" ? "success" : "neutral"
                    }`}>{result.type}</span>
                  </td>
                  <td className="muted">
                    {result.late && result.late.minutesLate > 0
                      ? `${result.late.minutesLate} min late${result.late.deduction ? ` · demo adjustment ${money(result.late.deduction)}` : ""}${result.type === "Cutoff Flag" ? ` · CEO: ${cutoffStatus(result.attendance.id)}` : ""}`
                      : result.attendance ? (result.attendance.timeOut ? "Attendance saved" : "Still clocked in")
                      : result.leave ? `${result.leave.type} (${result.leave.status})`
                      : result.absence ? (result.absence.reason || "No reason provided")
                      : result.type === "Rest Day" ? "Weekend · company schedule not yet configurable"
                      : "No completed attendance or approved leave recorded"}
                  </td>
                  <td>
                    {result.type === "Missing Record" && (
                      <button className="text-button" onClick={() => setAbsenceForm({
                        employeeId: employee.id, name: employee.name, reason: ""
                      })}>＋ Record Absent</button>
                    )}
                    {result.type === "Absent" && (
                      <button className="text-button danger-text"
                        onClick={() => setConfirmBox({
                          title: "Move this absence to Archives? ♡",
                          message: `${employee.name}'s absence on ${monitorDate} will go to Recently Deleted. The CEO can restore it.`,
                          onConfirm: () => removeAbsence(result.absence.id)
                        })}>
                        Undo Absence
                      </button>
                    )}
                    {!["Missing Record", "Absent"].includes(result.type) && <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!daily.length && <p className="empty">Add employees to start monitoring attendance.</p>}

        </div>
        <Pagination {...dailyPage} />
        {!isScheduledWeekday(monitorDate) && (
          <p className="muted" style={{ marginTop: 12 }}>Weekend selected. Workday schedules will be configurable later.</p>
        )}
      </section>

      <CutoffReviews
        data={data}
        admin={admin}
        submitCutoffExplanation={submitCutoffExplanation}
        decideCutoffReview={decideCutoffReview}
        reopenCutoffReview={reopenCutoffReview}
      />

      {}
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">LATE POLICY</span><h3>Late Arrival Brackets</h3></div>
        </div>
        <div className="fhilar-bracket-grid">
          {LATE_BRACKETS.map(b => (
            <div key={b.min} className="fhilar-bracket-card">
              <strong>{b.min}–{b.max} min</strong>
              <span>{b.percent}%</span>
            </div>
          ))}
          <div className="fhilar-bracket-card cutoff">
            <strong>60+ min</strong><span>Absent flag</span>
          </div>
        </div>

<p className="muted" style={{ marginTop: 14 }}>
  Late adjustments are calculated using the employee's
  scheduled daily pay and the corresponding percentage
  bracket. Arrivals of 60 minutes or
  more are flagged for absence review, while actual
  working hours remain recorded.
</p>

      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">THE TIME LOG</span><h3>Attendance History</h3></div>
          <button className="btn btn-primary" onClick={openNew}>＋ Add Record</button>
        </div>
        <div className="toolbar">
          <input placeholder="⌕ Search employees or ID..." value={search}
            onChange={e => { setSearch(e.target.value); attendancePage.resetPage(); }} />
          <input type="date" aria-label="Filter by clock-in date" value={date}
            onChange={e => { setDate(e.target.value); attendancePage.resetPage(); }} />
          <select aria-label="Filter by approval status" value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); attendancePage.resetPage(); }}>
            <option value="all">All approval statuses</option>
            <option value="Open">Open</option><option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
          </select>
          {(date || statusFilter !== "all") && (
            <button className="btn btn-outline" onClick={() => {
              setDate(""); setStatusFilter("all"); attendancePage.resetPage();
            }}>Clear</button>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>EMPLOYEE</th><th>SHIFT</th><th>TIME IN</th><th>TIME OUT</th>
              <th>HOURS</th><th>GROSS</th><th>TIME STATUS</th><th>LATE ADJUSTMENT</th>
              <th>APPROVAL</th><th>ACTION</th>
            </tr></thead>
            <tbody>
              {attendancePage.pageItems.map(a => {
                const pay = a.timeOut ? calculatePay(a) : null;
                const late = lateForRecord(a, data.settings);
                return <tr key={a.id}>
                  <td><strong>{nameOf(a.employeeId)}</strong><div className="muted">{a.employeeId}</div></td>
                  <td>{a.shiftLabel || getShiftLabel({ shift: a.shift }, data.settings)}</td>
                  <td>{displayDateTime(a.timeIn)}</td>
                  <td>{displayDateTime(a.timeOut)}</td>
                  <td>{pay ? pay.hours.toFixed(2) : "—"}</td>
                  <td>{pay ? money(pay.gross) : "Pending"}</td>
                  <td>
                    <span className={`fhilar-monitor-pill ${late.minutesLate >= 60 ? "danger" :
                      late.minutesLate > 0 ? "warning" : "success"}`}>
                      {late.minutesLate >= 60
                        ? `Cutoff · ${cutoffStatus(a.id) === "Confirmed" ? "CEO Confirmed" : cutoffStatus(a.id) === "Excused" ? "Excused" : "Pending CEO Review"}`
                        : late.status}
                    </span>
                    {late.minutesLate > 0 && <div className="muted">{late.minutesLate} min late</div>}
                  </td>
                  <td>{late.deduction ? money(late.deduction) : "—"}</td>
                  <td><span className={`status ${a.status === "Approved" ? "green" : a.status === "Open" ? "gray" : "pink"}`}>
                    {a.status}
                  </span></td>
                  <td><div className="table-actions">
                    {!a.payrollId && (
                      <>
                        {isCEO && <button className="text-button" onClick={() => openEdit(a)}>Edit</button>}
                        {a.timeOut && a.status === "Draft" && (
                          <button className="text-button" onClick={() => approveAttendance(a.id)}>Approve</button>
                        )}
                        {isCEO && a.status === "Approved" && (
                          <button className="text-button" onClick={() => returnAttendanceToDraft(a.id)}>Reopen</button>
                        )}
                      </>
                    )}
                    {isCEO && !a.payrollId && <button className="text-button danger-text"
                      onClick={() => setConfirmBox({
                        title: "Move attendance to Archives? ♡",
                        message: `${nameOf(a.employeeId)}'s attendance record will be moved to Recently Deleted, where the CEO can recover it.`,
                        onConfirm: () => deleteAttendance(a.id)
                      })}>
                      Delete
                    </button>}
                    {a.payrollId && <small className="muted">Locked</small>}
                    {!isCEO && !a.payrollId && a.status === "Approved" && (
                      <small className="muted">CEO-only editing</small>
                    )}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
          {!records.length && <p className="empty">No matching attendance records.</p>}

        </div>
        <Pagination {...attendancePage} />
      </section>

      {absenceForm && <Modal title="Record an Absence ♡" onClose={() => setAbsenceForm(null)}>
        <form className="form-grid" onSubmit={submitAbsence}>
          <p className="full">Employee: <strong>{absenceForm.name}</strong><br />Work date: <strong>{monitorDate}</strong></p>
          <label className="full">Reason (optional)
            <input maxLength={160} placeholder="e.g. Unexcused / unable to report"
              value={absenceForm.reason} onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })} />
          </label>
          <p className="muted full">Only completed, past scheduled weekdays can be marked absent. Approved leave and existing time logs are protected.</p>
          <div className="modal-actions full">
            <button type="button" className="btn btn-outline" onClick={() => setAbsenceForm(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Record Absent ✿</button>
          </div>
        </form>
      </Modal>}

      {form && <Modal title={editId ? "Correct Attendance ♡" : "Manual Attendance ✿"} onClose={() => setForm(null)}>
        <form onSubmit={submit} className="form-grid">
          <label className="full">Employee
            <select value={form.employeeId} required disabled={Boolean(editId)}
              onChange={e => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select employee</option>
              {data.employees.filter(e => e.active || e.id === form.employeeId).map(e =>
                <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
            </select>
          </label>
          {[["timeIn", "Time In (PH)"], ["timeOut", "Time Out (PH)"],
            ["breakStart", "Unpaid Break Start (optional)"], ["breakEnd", "Unpaid Break End (optional)"]]
            .map(([key, label]) => <label key={key}>{label}
              <input type="datetime-local" required={key === "timeIn" || key === "timeOut"}
                max={phDateTime()} value={form[key]} onChange={e => setForm(previous => ({ ...previous, [key]: e.target.value }))} />
            </label>)}
          <p className="muted full">
          Future time-in and time-out are not allowed. For overnight shifts, choose the
          actual next calendar day for time-out. Only the Super Admin can edit an existing record.
        </p>
          <div className="modal-actions full">
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Attendance ♡</button>
          </div>
        </form>
      </Modal>}
      {confirmBox && (
        <ConfirmDialog
          title={confirmBox.title}
          message={confirmBox.message}
          confirmLabel="Yes, Move to Archives ✿"
          danger
          onConfirm={confirmBox.onConfirm}
          onClose={() => setConfirmBox(null)}
        />
      )}
    </div>
  );
}

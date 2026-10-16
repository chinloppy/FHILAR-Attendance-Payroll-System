
import React, { useState } from "react";
import Pagination, { usePagination } from "../components/Pagination";
import Modal from "../components/Modal";
import { phDate, displayDate } from "../utils/payroll";
import {
  MATERNITY_CASES, maternityEndDate,
  leaveDayCount, leaveBalance
} from "../utils/leave";

const newForm = (employeeId = "") => ({
  employeeId,
  type: "Sick Leave",
  start: phDate(),
  end: phDate(),
  maternityCase: "live",
  reason: ""
});

function previewDays(form) {
  try { return leaveDayCount(form); }
  catch { return 0; }
}

export default function Leaves({ data, admin, submitLeave, reviewLeave, withdrawLeave }) {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [year, setYear] = useState(phDate().slice(0, 4));
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);

  const isCEO = admin?.role === "super_admin";
  const employees = data.employees || [];
  const active = employees.filter(e => e.active);
  const leaves = data.leaves || [];
  const chosenEmployee = employeeFilter || active[0]?.id || "";
  const selectedEmployee = employees.find(e => e.id === chosenEmployee);
  const names = id => employees.find(e => e.id === id)?.name || id;

  const currentYear = Number(phDate().slice(0, 4));
  const years = Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i));
  const selectedLeaves = leaves.filter(l => l.employeeId === chosenEmployee);
  const sick = leaveBalance(leaves, chosenEmployee, year, "Sick Leave");
  const vacation = leaveBalance(leaves, chosenEmployee, year, "Vacation Leave");
  const pendingCount = leaves.filter(l => l.status === "Pending").length;

  const shown = [...leaves]
    .filter(l => l.start <= `${year}-12-31` && l.end >= `${year}-01-01`)
    .filter(l => !employeeFilter || l.employeeId === employeeFilter)
    .filter(l => statusFilter === "all" || l.status === statusFilter)
    .filter(l => `${names(l.employeeId)} ${l.employeeId} ${l.type}`
      .toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

  const leavePage = usePagination(shown);

  function updateForm(field, value) {
    setForm(previous => {
      if (!previous) return previous;
      const next = { ...previous, [field]: value };
      if (next.type === "Maternity Leave") {
        try { next.end = maternityEndDate(next.start, next.maternityCase); }
        catch { next.end = ""; }
      } else if (field === "type") {
        next.end = next.start;
      }
      return next;
    });
  }

  function openNew() {
    setForm(newForm(chosenEmployee));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitLeave(form)) setForm(null);
  }

  // Keep the FHILAR cute confirmation, never the browser's window.confirm popup.
  function handleReview(id, decision) {
    const approving = decision === "approve";
    setConfirmBox({
      kind: approving ? "approve" : "reject",
      title: approving ? "Approve this leave request? ♡" : "Reject this leave request?",
      message: approving
        ? "This request will be approved and recorded in the employee's leave balance."
        : "The request will be rejected but will remain in the leave history.",
      confirmLabel: approving ? "Yes, Approve ✿" : "Yes, Reject",
      action: () => reviewLeave(id, decision)
    });
  }

  function handleWithdraw(item) {
    setConfirmBox({
      kind: "remove",
      title: "Move this leave request to Archives? ♡",
      message: `Remove ${item.type} for ${names(item.employeeId)}? The request will go to Archives if your shared workspace has archiving enabled.`,
      confirmLabel: "Yes, Remove",
      action: () => withdrawLeave(item.id)
    });
  }

  function runConfirmedAction() {
    if (confirmBox?.action?.()) setConfirmBox(null);
  }

  const maternity = selectedLeaves
    .filter(l => l.type === "Maternity Leave" && l.status === "Approved" && l.start <= `${year}-12-31` && l.end >= `${year}-01-01`)
    .length;

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">REST, RECOVER & RETURN</span>
          <h1>Leave Studio <span>✿</span></h1>
          <p>Care for the team, track every leave, and keep approvals organized.</p>
        </div>
        <button className="btn btn-primary" disabled={!active.length} onClick={openNew}>
          ＋ File Leave
        </button>
      </div>

      <section className="panel leave-intro">
        <div>
          <span className="eyebrow">A LITTLE CARE GOES A LONG WAY</span>
          <h2>Good work deserves time to rest. ♡</h2>
          <p>Track sick leave, vacation leave, and maternity leave in one lovely place.</p>
        </div>
        <div className="leave-intro-decoration" aria-hidden="true">✿ ♡ ✧</div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">LEAVE CREDITS</span>
            <h3>Employee Leave Balances</h3>
          </div>
        </div>
        <div className="leave-selector">
          <label>Employee
            <select value={chosenEmployee} onChange={e => { setEmployeeFilter(e.target.value); leavePage.resetPage(); }}>
              {!employees.length && <option value="">No employees yet</option>}
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
            </select>
          </label>
          <label>Calendar year
            <select value={year} onChange={e => { setYear(e.target.value); leavePage.resetPage(); }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        {!selectedEmployee ? (
          <p className="empty">Add an employee first to start tracking leave credits.</p>
        ) : (
          <div className="leave-cards">
            {[
              { title: "Sick Leave", balance: sick, symbol: "♡", className: "sick" },
              { title: "Vacation Leave", balance: vacation, symbol: "✿", className: "vacation" }
            ].map(card => (
              <div className={`leave-balance-card ${card.className}`} key={card.title}>
                <span className="leave-card-symbol" aria-hidden="true">{card.symbol}</span>
                <span className="eyebrow">{card.title.toUpperCase()}</span>
                <div className="leave-balance-number">{card.balance.available}<small> / {card.balance.allowance} days available</small></div>
                <div className="leave-progress"><span style={{ width: `${(card.balance.used / card.balance.allowance) * 100}%` }} /></div>
                <p>{card.balance.used} approved days used · {card.balance.pending} pending days reserved</p>
              </div>
            ))}
            <div className="leave-balance-card maternity">
              <span className="leave-card-symbol" aria-hidden="true">✧</span>
              <span className="eyebrow">MATERNITY LEAVE</span>
              <div className="leave-balance-number">105<small> calendar days (standard case)</small></div>
              <p>{maternity} approved maternity request(s) on record</p>
              <p>Eligible solo parent: 120 days · Miscarriage / ETP: 60 days</p>
            </div>
          </div>
        )}
        <p className="muted leave-policy-note">
          FHILAR demo policy: 20 SL and 20 VL working days per year. Monday-Friday is
          the temporary working-day assumption; holidays and employee-specific rest days
          aren't configured yet. Maternity entitlement requires eligibility verification.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">THE LEAVE LEDGER</span>
            <h3>Leave Requests & History</h3>
          </div>
          <span className="pill">{pendingCount} pending approval</span>
        </div>
        <div className="toolbar">
          <input placeholder="⌕ Search employee, ID, or leave type..." value={search}
            onChange={e => { setSearch(e.target.value); leavePage.resetPage(); }} />
          <select aria-label="Filter by status" value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); leavePage.resetPage(); }}>
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          {(search || statusFilter !== "all" || employeeFilter) && (
            <button className="btn btn-outline" onClick={() => {
              setSearch(""); setStatusFilter("all"); setEmployeeFilter(""); leavePage.resetPage();
            }}>Clear</button>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>EMPLOYEE</th><th>LEAVE TYPE</th><th>DATE RANGE</th>
              <th>DAYS</th><th>NOTE</th><th>STATUS</th><th>ACTION</th>
            </tr></thead>
            <tbody>
              {leavePage.pageItems.map(item => (
                <tr key={item.id}>
                  <td><strong>{names(item.employeeId)}</strong><div className="muted">{item.employeeId}</div></td>
                  <td>{item.type}{item.type === "Maternity Leave" && (
                    <div className="muted">{MATERNITY_CASES[item.maternityCase]?.label || "Calendar days"}</div>
                  )}</td>
                  <td>{displayDate(item.start)} – {displayDate(item.end)}</td>
                  <td>{item.days ?? leaveDayCount(item)}</td>
                  <td><span className="muted">{item.reason || "—"}</span></td>
                  <td><span className={`status ${item.status === "Approved" ? "green" : item.status === "Rejected" ? "gray" : "pink"}`}>
                    {item.status}
                  </span></td>
                  <td><div className="table-actions">
                    {isCEO && item.status === "Pending" && <>
                      <button className="text-button" onClick={() => handleReview(item.id, "approve")}>Approve</button>
                      <button className="text-button danger-text" onClick={() => handleReview(item.id, "reject")}>Reject</button>
                    </>}
                    {item.status !== "Approved" && (isCEO || item.submittedBy === admin?.id) && (
                      <button className="text-button danger-text" onClick={() => handleWithdraw(item)}>Remove</button>
                    )}
                    {item.status === "Approved" && <small className="muted">Recorded</small>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="empty">No matching leave records. File the first leave to get started. ✿</p>}
        </div>
        <Pagination {...leavePage} />
      </section>

      {form && (
        <Modal title="File a Leave Request ♡" onClose={() => setForm(null)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="full">Employee
              <select required value={form.employeeId}
                onChange={e => updateForm("employeeId", e.target.value)}>
                <option value="">Choose employee</option>
                {active.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
              </select>
            </label>
            <label className="full">Leave Type
              <select value={form.type} onChange={e => updateForm("type", e.target.value)}>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Vacation Leave">Vacation Leave</option>
                <option value="Maternity Leave">Maternity Leave</option>
              </select>
            </label>
            {form.type === "Maternity Leave" && (
              <label className="full">Maternity Category (eligibility subject to verification)
                <select value={form.maternityCase} onChange={e => updateForm("maternityCase", e.target.value)}>
                  {Object.entries(MATERNITY_CASES).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label>Start Date
              <input type="date" required value={form.start} onChange={e => updateForm("start", e.target.value)} />
            </label>
            <label>End Date {form.type === "Maternity Leave" ? "(automatic)" : ""}
              <input type="date" required value={form.end}
                readOnly={form.type === "Maternity Leave"}
                onChange={e => updateForm("end", e.target.value)} />
            </label>
            <div className="leave-request-summary full">
              <strong>{previewDays(form)} {form.type === "Maternity Leave" ? "calendar" : "working"} day(s)</strong>
              <span>Requests start as Pending and require Super Admin approval.</span>
            </div>
            <label className="full">Reason (optional — avoid personal medical details)
              <textarea className="leave-reason-input" rows="3" maxLength="240" placeholder="Short note (optional)"
                value={form.reason} onChange={e => updateForm("reason", e.target.value)} />
            </label>
            <p className="muted full">
              Approved SL/VL will consume leave credits. This phase only records leave;
              it does not calculate paid leave wages or maternity SSS benefits yet.
            </p>
            <div className="modal-actions full">
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Submit Leave ♡</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmBox && (
        <Modal title="" onClose={() => setConfirmBox(null)}>
          <div className="cute-confirm">
            <div className={`cute-confirm-icon ${confirmBox.kind}`} aria-hidden="true">
              {confirmBox.kind === "approve" ? "✿" : "♡"}
            </div>
            <h3>{confirmBox.title}</h3>
            <p>{confirmBox.message}</p>
            <div className="cute-confirm-actions">
              <button type="button" className="btn btn-outline"
                onClick={() => setConfirmBox(null)}>Cancel</button>
              <button type="button" className="btn btn-primary"
                onClick={runConfirmedAction}>{confirmBox.confirmLabel}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

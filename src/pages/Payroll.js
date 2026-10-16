
import React, { useState } from "react";
import Pagination, { PaginatedRows, usePagination } from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Payslip from "../components/Payslip";
import {
  money,
  phDate,
  displayDate,
  displayDateTime,
  calculatePay,
  runTotal,
  workDate
} from "../utils/payroll";

export default function Payroll({
  data,
  admin,
  createPayroll,
  payrollAction,
  adjustPayrollLine
}) {
  const isCEO = admin?.role === "super_admin";
  const today = phDate();

  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const [selectedId, setSelectedId] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [reference, setReference] = useState("");
  const [runSearch, setRunSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adjustment, setAdjustment] = useState(null);
  const [payslipId, setPayslipId] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const selected = data.runs.find(run => run.id === selectedId);
  const lines = selected?.lines.filter(
    line => employeeFilter === "all" || line.employeeId === employeeFilter
  ) || [];
  const filteredRuns = data.runs.filter(run =>
    `${run.id} ${run.start} ${run.end} ${run.status}`
      .toLowerCase()
      .includes(runSearch.toLowerCase()) &&
    (statusFilter === "all" || statusFilter === run.status)
  );
  const hasAdjustments = selected?.lines.some(
    line => Number(line.extraPay) > 0 || Number(line.deduction) > 0
  );
  const payslipLine = selected?.lines.find(line => line.employeeId === payslipId);

  const historyPage = usePagination(filteredRuns);
  const breakdownPage = usePagination(lines);
  const attendanceRows = lines.flatMap(line =>
    line.attendance.map(record => ({ line, record }))
  );
  const attendancePage = usePagination(attendanceRows);

  function resetDetailPages() {
    breakdownPage.resetPage();
    attendancePage.resetPage();
  }


  function action(type) {
    if (payrollAction(selectedId, type, reference)) {
      setReference("");
    }
  }

  function cancel() {
    if (payrollAction(selectedId, "cancel")) {
      setSelectedId(null);
      setConfirmCancel(false);
    }
  }

  function saveAdjustment(event) {
    event.preventDefault();
    if (adjustPayrollLine(selectedId, adjustment.employeeId, adjustment)) {
      setAdjustment(null);
    }
  }

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">GOOD WORK, GOOD PAY</span>
          <h1>Payroll Studio <span>♡</span></h1>
          <p>Actual work hours, night pay, and clearly separated classroom late adjustments.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CREATE A PAYROLL</span>
            <h3>Select the payroll period</h3>
          </div>
        </div>
        <form className="toolbar" onSubmit={event => {
          event.preventDefault();
          createPayroll(start, end);
        }}>
          <label>
            From
            <input required type="date" value={start} onChange={event => setStart(event.target.value)} />
          </label>
          <label>
            To
            <input required type="date" value={end} onChange={event => setEnd(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary">＋ Generate Payroll</button>
        </form>
        <p className="muted">
          Only completed, approved attendance is eligible. Draft payroll locks its
          attendance until the run is cancelled.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PAYROLL HISTORY</span>
            <h3>Payroll Runs</h3>
          </div>
        </div>
        <div className="toolbar">
          <input
            placeholder="⌕ Search payroll ID, date, or status..."
            value={runSearch}
            onChange={event => { setRunSearch(event.target.value); historyPage.resetPage(); }}
          />
          <select
            aria-label="Filter payroll status"
            value={statusFilter}
            onChange={event => { setStatusFilter(event.target.value); historyPage.resetPage(); }}
          >
            <option value="all">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Pending approval">Pending approval</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>RUN ID</th>
                <th>PERIOD</th>
                <th>EMPLOYEES</th>
                <th>GROSS PAY</th>
                <th>NET PAY</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              <PaginatedRows items={filteredRuns} pageItems={historyPage.pageItems} renderRow={run => (
                <tr key={run.id}>
                  <td><strong>{run.id}</strong></td>
                  <td>{displayDate(run.start)} – {displayDate(run.end)}</td>
                  <td>{run.lines.length}</td>
                  <td>{money(runTotal(run))}</td>
                  <td>
                    <strong>{money(run.lines.reduce((total, line) => total + (line.net ?? line.gross), 0))}</strong>
                  </td>
                  <td><span className={`status ${run.status === "Paid" ? "green" : "pink"}`}>{run.status}</span></td>
                  <td>
                    <button className="text-button" onClick={() => {
                      setSelectedId(run.id);
                        resetDetailPages();
                      setEmployeeFilter("all");
                      setReference("");
                      setPayslipId(null);
                    }}>
                      View Details ↗
                    </button>
                  </td>
                </tr>
              )} />
            </tbody>
          </table>
          {!filteredRuns.length && (
            <p className="empty">No matching payroll runs. Approve attendance to begin.</p>
          )}
        </div>
        <Pagination {...historyPage} />
      </section>

      {selected && (
        <section className="panel payroll-detail">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PAYROLL BREAKDOWN</span>
              <h3>{selected.id}</h3>
              <p className="muted">
                {displayDate(selected.start)} – {displayDate(selected.end)} · {selected.status}
              </p>
            </div>
            <button
              className="icon-button print-hide"
              aria-label="Close payroll details"
              onClick={() => setSelectedId(null)}
            >
              ×
            </button>
          </div>

          <div className="toolbar print-hide">
            <label>
              Employee
              <select value={employeeFilter} onChange={event => { setEmployeeFilter(event.target.value); resetDetailPages(); }}>
                <option value="all">All employees</option>
                {selected.lines.map(line => (
                  <option key={line.employeeId} value={line.employeeId}>{line.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>HOURS</th>
                  <th>NIGHT HOURS</th>
                  <th>BASE PAY</th>
                  <th>NIGHT PAY</th>
                  <th>EXTRAS</th>
                  <th>DEMO LATE</th>
                  <th>OTHER DED.</th>
                  <th>TOTAL DED.</th>
                  <th>NET PAY</th>
                  <th className="print-hide">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <PaginatedRows items={lines} pageItems={breakdownPage.pageItems} renderRow={line => (
                  <tr key={line.employeeId}>
                    <td>
                      <strong>{line.name}</strong>
                      <div className="muted">{line.employeeId}</div>
                    </td>
                    <td>{line.hours.toFixed(2)}</td>
                    <td>{line.nightHours.toFixed(2)}</td>
                    <td>{money(line.basePay)}</td>
                    <td>{money(line.nightPay)}</td>
                    <td>{money(line.extraPay || 0)}</td>
                    <td>{money(line.lateDeduction || 0)}</td>
                    <td>{money(line.otherDeduction ?? Math.max(0, Number(line.deduction || 0) - Number(line.lateDeduction || 0)))}</td>
                    <td>{money(line.deduction || 0)}</td>
                    <td><strong>{money(line.net ?? line.gross)}</strong></td>
                    <td className="print-hide">
                      <div className="table-actions">
                        {selected.status === "Draft" && (
                          <button className="text-button" onClick={() => setAdjustment({
                            employeeId: line.employeeId,
                            name: line.name,
                            extraPay: line.extraPay || 0,
                            extraNote: line.extraNote || "",
                            lateDeduction: line.lateDeduction || 0,
                            otherDeduction: line.otherDeduction ?? Math.max(0, Number(line.deduction || 0) - Number(line.lateDeduction || 0)),
                            otherDeductionNote: line.otherDeductionNote || (line.lateDeduction ? "" : line.deductionNote || "")
                          })}>
                            Adjust
                          </button>
                        )}
                        <button className="text-button" onClick={() => setPayslipId(line.employeeId)}>
                          Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                )} />
              </tbody>
            </table>
          </div>

          <Pagination {...breakdownPage} />

          <div className="payroll-total">
            <span>NET PAY · SELECTED EMPLOYEES</span>
            <h2>{money(lines.reduce((total, line) => total + (line.net ?? line.gross), 0))}</h2>
          </div>

          {hasAdjustments && (
            <p className="muted">
              Demo late adjustments are included in total deductions but shown separately from any other manual adjustments. Actual-hours pay is already reflected in the base earnings.
            </p>
          )}

          <h3 className="detail-title">Attendance used for these earnings</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>WORK DATE</th>
                  <th>TIME IN</th>
                  <th>TIME OUT</th>
                  <th>RATE</th>
                  <th>HOURS</th>
                  <th>NIGHT PAY</th>
                  <th>GROSS</th>
                  <th>LATE MIN</th>
                  <th>DEMO LATE</th>
                </tr>
              </thead>
              <tbody>
                <PaginatedRows items={attendanceRows} pageItems={attendancePage.pageItems} renderRow={({ line, record }) => {
                  const pay = calculatePay(record);
                  return (
                    <tr key={record.id}>
                      <td>{line.name}</td>
                      <td>{displayDate(record.late?.scheduledDate || workDate(record))}</td>
                      <td>{displayDateTime(record.timeIn)}</td>
                      <td>{displayDateTime(record.timeOut)}</td>
                      <td>{money(record.rate)}</td>
                      <td>{pay.hours.toFixed(2)}</td>
                      <td>{money(pay.nightPay)}</td>
                      <td>{money(pay.gross)}</td>
                      <td>{record.late?.minutesLate ?? "—"}</td>
                      <td>{money(record.late?.deduction || 0)}</td>
                    </tr>
                  );
                }} />
              </tbody>
            </table>
          </div>

          <Pagination {...attendancePage} />

          {selected.paymentReference && (
            <p className="muted">
              Paid on {selected.paymentDate} · Payment reference: {selected.paymentReference}
            </p>
          )}

          {!isCEO && ["Pending approval", "Approved"].includes(selected.status) && (
            <p className="ceo-approval-note">
              ♡ This payroll is awaiting Super Admin review. Final approval,
              corrections, and payment recording are managed by the CEO.
            </p>
          )}

          <div className="modal-actions print-hide">
            {selected.status === "Draft" && (
              <button className="btn btn-primary" onClick={() => action("submit")}>
                Submit for Approval
              </button>
            )}

            {selected.status === "Pending approval" && isCEO && (
              <button className="btn btn-primary" onClick={() => action("approve")}>
                ♛ Approve Payroll
              </button>
            )}

            {selected.status === "Approved" && isCEO && (
              <>
                <input
                  aria-label="Payment reference"
                  placeholder="Payment reference"
                  value={reference}
                  onChange={event => setReference(event.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={!reference.trim()}
                  onClick={() => action("pay")}
                >
                  ♛ Record Payment
                </button>
              </>
            )}

            {isCEO && ["Pending approval", "Approved"].includes(selected.status) && (
              <button className="btn btn-outline" onClick={() => action("return")}>
                Return to Draft
              </button>
            )}

            {selected.status !== "Paid" && (isCEO || selected.status === "Draft") && (
              <button className="btn btn-outline" onClick={() => setConfirmCancel(true)}>
                Cancel Run
              </button>
            )}

            <button className="btn btn-outline" onClick={() => window.print()}>
              Print Payroll ↗
            </button>
          </div>
        </section>
      )}

      {adjustment && (
        <Modal title={`Adjust earnings · ${adjustment.name}`} onClose={() => setAdjustment(null)}>
          <form className="form-grid" onSubmit={saveAdjustment}>
            <label>
              Additional Earnings (₱)
              <input
                type="number" required min="0" step="0.01"
                value={adjustment.extraPay}
                onChange={event => setAdjustment({ ...adjustment, extraPay: event.target.value })}
              />
            </label>
            <label>
              Other manual deduction (₱)
              <input
                type="number" required min="0" step="0.01"
                value={adjustment.otherDeduction}
                onChange={event => setAdjustment({ ...adjustment, otherDeduction: event.target.value })}
              />
            </label>
            <label>
              Reason for additional earnings
              <input
                value={adjustment.extraNote}
                placeholder="e.g. approved allowance"
                onChange={event => setAdjustment({ ...adjustment, extraNote: event.target.value })}
              />
            </label>
            <label>
              Reason for other deduction
              <input
                value={adjustment.otherDeductionNote}
                placeholder="e.g. approved adjustment"
                onChange={event => setAdjustment({ ...adjustment, otherDeductionNote: event.target.value })}
              />
            </label>
            <p className="muted full">
              Frozen classroom late adjustment: {money(adjustment.lateDeduction || 0)}.
              This amount is separate from the editable manual deduction.
              Only draft payroll can be adjusted. Statutory deductions and paid leave are not yet implemented.
            </p>
            <div className="modal-actions full">
              <button type="button" className="btn btn-outline" onClick={() => setAdjustment(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">Save Adjustment ♡</button>
            </div>
          </form>
        </Modal>
      )}

      {selected && payslipLine && (
        <Payslip
          run={selected}
          line={payslipLine}
          company={data.settings.company}
          onClose={() => setPayslipId(null)}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel this payroll run? ♡"
          message="This unpaid payroll will move to Archives and its attendance records will unlock. The CEO can restore the original draft if nothing has changed."
          danger
          confirmLabel="Yes, Archive Payroll ✿"
          onClose={() => setConfirmCancel(false)}
          onConfirm={cancel}
        />
      )}
    </div>
  );
}

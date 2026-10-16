
import React, { useState } from "react";
import Pagination, { PaginatedRows, usePagination } from "../components/Pagination";
import { money, displayDate, runTotal } from "../utils/payroll";
export default function Reports({ data }) {
  const [status, setStatus] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const runs = data.runs.filter(run =>
    (status === "all" || status === run.status) &&
    (!from || run.end >= from) && (!to || run.start <= to) &&
    (employeeId === "all" || run.lines.some(l => l.employeeId === employeeId))
  );
  const lines = runs.flatMap(run => run.lines.filter(l => employeeId === "all" || l.employeeId === employeeId)
    .map(l => ({ ...l, runId: run.id, status: run.status })));
  const runsPage = usePagination(runs);
  const earningsPage = usePagination(lines);
  function resetReportPages() { runsPage.resetPage(); earningsPage.resetPage(); }

  const sum = key => lines.reduce((total, line) => total + Number(line[key] || 0), 0);
  function exportCSV() {
    if (!lines.length) return;
    const escapeCSV = value => {
      let text = String(value == null ? "" : value);
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const header = ["Payroll ID", "Employee ID", "Employee", "Status", "Hours", "Night Hours", "Base Pay", "Night Pay", "Extra Earnings", "Deductions", "Gross Pay", "Net Pay"];
    const rows = lines.map(line => [line.runId, line.employeeId, line.name, line.status,
      line.hours.toFixed(2), line.nightHours.toFixed(2), line.basePay.toFixed(2), line.nightPay.toFixed(2),
      Number(line.extraPay || 0).toFixed(2), Number(line.deduction || 0).toFixed(2),
      line.gross.toFixed(2), (line.net ?? line.gross).toFixed(2)]);
    const csv = [header, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "FHILAR-Payroll-Report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  return <div className="page-enter report-page">
    <div className="page-title-row"><div><span className="eyebrow">THE BIG PICTURE</span><h1>Reports & Insights <span>✿</span></h1>
      <p>Your payroll summaries, thoughtfully organized.</p></div>
      <div className="report-actions print-hide">
        <button className="btn btn-outline" disabled={!lines.length} onClick={exportCSV}>Export CSV ↗</button>
        <button className="btn btn-primary" onClick={() => window.print()}>Print Report ↗</button>
      </div></div>
    <div className="stats-grid">
      {[["Payroll Runs", runs.length], ["Total Work Hours", sum("hours").toFixed(2)],
        ["Night Differential", money(sum("nightPay"))], ["Total Net Pay", money(lines.reduce((total, line) => total + (line.net ?? line.gross), 0))]]
        .map(([label, value]) => <div className="stat-card" key={label}><p>{label}</p><h3>{value}</h3></div>)}
    </div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">PAYROLL SUMMARIES</span><h3>Review your payroll records</h3></div></div>
      <div className="toolbar print-hide"><label>Status<select value={status} onChange={e => { setStatus(e.target.value); resetReportPages(); }}>
        <option value="all">All</option><option value="Draft">Draft</option><option value="Pending approval">Pending approval</option>
        <option value="Approved">Approved</option><option value="Paid">Paid</option></select></label>
        <label>Employee<select value={employeeId} onChange={e => { setEmployeeId(e.target.value); resetReportPages(); }}>
          <option value="all">All employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label>From<input type="date" value={from} onChange={e => { setFrom(e.target.value); resetReportPages(); }} /></label>
        <label>To<input type="date" value={to} onChange={e => { setTo(e.target.value); resetReportPages(); }} /></label></div>
      <div className="table-scroll"><table><thead><tr><th>PAYROLL ID</th><th>PERIOD</th><th>EMPLOYEES</th><th>GROSS PAY</th><th>STATUS</th></tr></thead>
        <tbody><PaginatedRows items={runs} pageItems={runsPage.pageItems} renderRow={run => <tr key={run.id}><td>{run.id}</td><td>{displayDate(run.start)} – {displayDate(run.end)}</td>
          <td>{employeeId === "all" ? run.lines.length : 1}</td>
          <td>{money(employeeId === "all" ? runTotal(run) : run.lines.filter(l => l.employeeId === employeeId).reduce((n, l) => n + l.gross, 0))}</td>
          <td>{run.status}</td></tr>} /></tbody></table>{!runs.length && <p className="empty">No payroll runs for these filters.</p>}</div>
      <Pagination {...runsPage} />
    </section>
    <section className="panel"><div className="panel-heading"><h3>Employee Earnings Breakdown</h3></div>
      <div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>RUN</th><th>HOURS</th><th>NIGHT HOURS</th><th>BASE PAY</th><th>NIGHT PAY</th><th>GROSS</th><th>NET</th></tr></thead>
        <tbody><PaginatedRows items={lines} pageItems={earningsPage.pageItems} renderRow={l => <tr key={`${l.runId}-${l.employeeId}`}><td>{l.name}</td><td>{l.runId}</td><td>{l.hours.toFixed(2)}</td>
          <td>{l.nightHours.toFixed(2)}</td><td>{money(l.basePay)}</td><td>{money(l.nightPay)}</td><td>{money(l.gross)}</td><td><strong>{money(l.net ?? l.gross)}</strong></td></tr>} /></tbody></table>
        {!lines.length && <p className="empty">No matching earnings records.</p>}</div>
      <Pagination {...earningsPage} />
    </section>
  </div>;
}

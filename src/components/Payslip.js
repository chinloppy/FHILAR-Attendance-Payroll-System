import React from "react";
import Modal from "./Modal";
import { displayDate, displayDateTime, money, calculatePay, workDate } from "../utils/payroll";

export default function Payslip({ run, line, company, onClose }) {
  return <Modal title="Employee Payslip ♡" onClose={onClose}>
    <div className="payslip-print">
      <div className="payslip-header"><img src="/fhilar-logo.png" alt="FHILAR Apparel" />
        <div><strong>{company}</strong><span>EMPLOYEE PAYSLIP</span></div>
      </div>
      <div className="payslip-meta">
        <div><small>EMPLOYEE</small><strong>{line.name}</strong><span>{line.employeeId} · {line.position}</span></div>
        <div><small>PAYROLL PERIOD</small><strong>{displayDate(run.start)} – {displayDate(run.end)}</strong><span>{run.id} · {run.status}</span></div>
      </div>
      <div className="table-scroll"><table><thead><tr><th>WORK DATE</th><th>TIME IN</th><th>TIME OUT</th><th>HOURS</th><th>NIGHT HOURS</th><th>GROSS</th></tr></thead>
        <tbody>{line.attendance.map(record => {
          const pay = calculatePay(record);
          return <tr key={record.id}><td>{displayDate(workDate(record))}</td><td>{displayDateTime(record.timeIn)}</td>
            <td>{displayDateTime(record.timeOut)}</td><td>{pay.hours.toFixed(2)}</td><td>{pay.nightHours.toFixed(2)}</td><td>{money(pay.gross)}</td></tr>;
        })}</tbody></table></div>
      <div className="payslip-ledger">
        <div><span>Paid working hours</span><strong>{line.hours.toFixed(2)}</strong></div>
        <div><span>Base earnings</span><strong>{money(line.basePay)}</strong></div>
        <div><span>Night differential</span><strong>{money(line.nightPay)}</strong></div>
        <div><span>Additional earnings {line.extraNote ? `(${line.extraNote})` : ""}</span><strong>{money(line.extraPay || 0)}</strong></div>
        <div><span>Gross compensation</span><strong>{money(line.gross)}</strong></div>
        <div><span>Deductions {line.deductionNote ? `(${line.deductionNote})` : ""}</span><strong>– {money(line.deduction || 0)}</strong></div>
        <div className="payslip-net"><span>NET PAY</span><strong>{money(line.net ?? line.gross)}</strong></div>
      </div>
      <p className="muted">{run.status === "Paid" ? `Recorded payment reference: ${run.paymentReference}` : "Payment has not been recorded. This is an estimated/pending payslip."}</p>
    </div>
    <div className="modal-actions print-hide"><button className="btn btn-outline" onClick={onClose}>Close</button>
      <button className="btn btn-primary" onClick={() => window.print()}>Print Payslip ↗</button></div>
  </Modal>;
}

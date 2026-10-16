import React, { useState } from "react";
import { money, phDate, workDate, displayDateTime, calculatePay } from "../utils/payroll";

export default function Dashboard({ data, setPage }) {
  const [period, setPeriod] = useState(phDate().slice(0, 7));
  const active = data.employees.filter(e => e.active);
  const today = phDate();
  const present = new Set(data.attendance.filter(a => workDate(a) === today).map(a => a.employeeId));
  const completed = data.attendance.filter(a => a.timeOut);
  const currentMonth = completed.filter(a => workDate(a).startsWith(period));
  const hours = currentMonth.reduce((sum, a) => sum + calculatePay(a).hours, 0);
  const gross = currentMonth.reduce((sum, a) => sum + calculatePay(a).gross, 0);
  const stats = [
    ["Active Employees", active.length, "♡"],
    ["Currently Working", data.attendance.filter(a => !a.timeOut).length, "◷"],
    ["Present Today", present.size, "✿"],
    ["No Clock-in Today", active.filter(e => !present.has(e.id)).length, "☼"],
    ["Completed Work Hours", hours.toFixed(2), "⌁"],
    ["Estimated Monthly Pay", money(gross), "₱"]
  ];
  const nameOf = id => data.employees.find(e => e.id === id)?.name || id;
  const recent = [...data.attendance].sort((a, b) => Date.parse(b.timeIn) - Date.parse(a.timeIn)).slice(0, 5);
  return <div className="page-enter">
    <section className="hero">
      <div className="hero-content"><span className="hero-tag">✿ THE DAILY WORKPLACE EDIT</span>
        <h1>Hello, lovely!<br /><em>Welcome to FHILAR.</em></h1>
        <p>A little space to track the team, celebrate hard work, and make every hour count.</p>
        <button className="btn btn-primary" onClick={() => setPage("attendance")}>View Attendance <span>↗</span></button>
      </div>
      <div className="hero-art" aria-hidden="true"><span className="hero-sun">✳</span>
        <div className="hero-paper"><small>THE DAILY EDIT</small><span className="hero-paper-flower">✿</span><strong>WORK</strong><em>with love.</em></div>
        <span className="hero-sticker">made for you ♡</span>
      </div>
    </section>
    <div className="section-heading"><div><span className="eyebrow">AT A GLANCE</span><h2>Your little overview <span>✿</span></h2></div>
      <label className="month-filter">Select month<input type="month" value={period} onChange={e => setPeriod(e.target.value)} /></label></div>
    <div className="stats-grid">{stats.map(([label, value, symbol]) =>
      <div className="stat-card" key={label}><span className="stat-icon">{symbol}</span><p>{label}</p><h3>{value}</h3><small>From your FHILAR attendance data</small></div>)}</div>
    <div className="dashboard-columns">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT UPDATES</span><h3>Attendance activity</h3></div>
        <button className="text-button" onClick={() => setPage("attendance")}>View all ↗</button></div>
        {recent.length ? recent.map(a => <div className="activity-item" key={a.id}>
          <span className="activity-avatar">✿</span><div><strong>{nameOf(a.employeeId)}</strong><p>{a.timeOut ? "Completed a shift" : "Currently clocked in"} · {a.status}</p></div>
          <small>{displayDateTime(a.timeIn)}</small></div>) : <p className="empty">No attendance recorded yet.</p>}
      </section>
      <section className="panel soft-panel"><span className="eyebrow">PAYROLL CORNER</span><h3>Payday, made simple.</h3>
        <p>Attendance, approval, and employee earnings—neatly organized in one place.</p>
        <div className="payday-decoration" aria-hidden="true">₱ ✿ ♡</div>
        <strong>{data.runs.length} payroll runs created</strong>
        <button className="btn btn-outline" onClick={() => setPage("payroll")}>Explore Payroll ↗</button>
      </section>
    </div>
  </div>;
}

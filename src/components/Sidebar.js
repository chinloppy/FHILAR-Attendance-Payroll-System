
import React from "react";

const links = [
  ["dashboard", "Dashboard", "✿"],
  ["employees", "Employees", "♡"],
  ["leaves", "Leaves", "✿"],
  ["attendance", "Attendance", "◷"],
  ["payroll", "Payroll", "₱"],
  ["reports", "Reports", "▤"],
  ["archives", "Archives", "↺"],
  ["settings", "Settings", "⚙"]
];

export default function Sidebar({ page, setPage, onLogout, admin }) {
  const isSuperAdmin = admin?.role === "super_admin";
  const visibleLinks = isSuperAdmin
    ? [["ceo", "CEO Overview", "♛"], ...links.slice(0, -1), ["activityLogs", "Activity Logs", "◴"], links[links.length - 1]]
    : links;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/fhilar-logo.png" alt="FHILAR Apparel logo" className="brand-logo" />
        <span className="brand-caption">THE WORKPLACE STUDIO</span>
      </div>

      <div className="sidebar-divider" />
      <p className="sidebar-label">
        {isSuperAdmin ? "EXECUTIVE WORKSPACE" : "YOUR WORKSPACE"}
      </p>

      <nav className="nav-list" aria-label="Main navigation">
        {visibleLinks.map(([key, label, symbol]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPage(key)}
            className={`nav-item ${page === key ? "active" : ""}`}
            aria-current={page === key ? "page" : undefined}
          >
            <span className="nav-symbol">{symbol}</span>
            <span>{label}</span>
            {page === key && <span className="nav-sparkle">✧</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span>{isSuperAdmin ? "♛ CEO'S LITTLE REMINDER" : "✿ A LITTLE REMINDER"}</span>
          <p>{isSuperAdmin ? "Lead with care, grow with purpose." : "Good work deserves good pay."}</p>
          <small>Made with love for FHILAR.</small>
        </div>
        <p className="sidebar-footer">© FHILAR Apparel</p>
      </div>
    </aside>
  );
}

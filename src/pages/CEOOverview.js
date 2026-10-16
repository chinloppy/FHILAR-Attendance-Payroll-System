
import React from "react";
import { money } from "../utils/payroll";

export default function CEOOverview({
  data,
  listAdmins,
  setPage
}) {
  const admins = listAdmins();

  const activeEmployees = data.employees.filter(
    employee => employee.active
  ).length;

  const pendingPayroll = data.runs.filter(
    run => run.status === "Pending approval"
  );

  const paidPayroll = data.runs.filter(
    run => run.status === "Paid"
  );

  const totalPaid = paidPayroll.reduce(
    (total, run) =>
      total + run.lines.reduce(
        (sum, line) =>
          sum + Number(line.net ?? line.gross),
        0
      ),
    0
  );

  const stats = [
    {
      label: "Registered Admins",
      value: Math.max(0, admins.length - 1),
      icon: "♡"
    },
    {
      label: "Active Employees",
      value: activeEmployees,
      icon: "✿"
    },
    {
      label: "Payroll Awaiting Approval",
      value: pendingPayroll.length,
      icon: "◷"
    },
    {
      label: "Completed Payments",
      value: paidPayroll.length,
      icon: "✓"
    },
    {
      label: "Total Recorded Net Payments",
      value: money(totalPaid),
      icon: "₱"
    },
    {
      label: "Total Payroll Runs",
      value: data.runs.length,
      icon: "▤"
    }
  ];

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">
            ✧ EXECUTIVE MANAGEMENT
          </span>

          <h1>
            CEO Control Center <span>♡</span>
          </h1>

          <p>
            A lovely little overview of your
            entire FHILAR workspace.
          </p>
        </div>
      </div>

      <section className="panel ceo-welcome">
        <span className="eyebrow">
          FHILAR APPAREL · SUPER ADMIN
        </span>

        <h2>Welcome, Boss! ♡</h2>

        <p>
          You're viewing the executive workspace.
          Review payroll approvals, monitor the team,
          and manage important company settings.
        </p>
      </section>

      <div className="stats-grid">
        {stats.map(stat => (
          <div className="stat-card" key={stat.label}>
            <span className="stat-icon">
              {stat.icon}
            </span>

            <p>{stat.label}</p>
            <h3>{stat.value}</h3>

            <small>FHILAR Company Overview</small>
          </div>
        ))}
      </div>

      <section className="panel">
        <span className="eyebrow">
          NEEDS YOUR ATTENTION
        </span>

        <h3>Pending Payroll Approval</h3>

        {pendingPayroll.length === 0 ? (
          <p className="muted">
            All caught up, lovely! No payroll is
            currently waiting for approval. ✿
          </p>
        ) : (
          <div className="admin-directory">
            {pendingPayroll.map(run => (
              <div
                className="admin-directory-row"
                key={run.id}
              >
                <div>
                  <strong>{run.id}</strong>

                  <small>
                    {run.start} to {run.end}
                    {" · "}
                    {run.lines.length} employees
                  </small>
                </div>

                <button
                  className="btn btn-outline"
                  onClick={() => setPage("payroll")}
                >
                  Review ↗
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <span className="eyebrow">
          EXECUTIVE SHORTCUTS
        </span>

        <h3>CEO Management Tools</h3>

        <div className="ceo-actions">
          <button
            className="btn btn-primary"
            onClick={() => setPage("payroll")}
          >
            ♡ Payroll Approvals
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setPage("settings")}
          >
            ⚙ Company Settings
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setPage("reports")}
          >
            ▤ Financial Reports
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setPage("employees")}
          >
            ✿ Employee Directory
          </button>
        </div>
      </section>

      <section className="panel">
        <span className="eyebrow">
          ACCESS MANAGEMENT
        </span>

        <h3>Registered Administrators</h3>

        <div className="admin-directory">
          {admins.map(account => (
            <div
              className="admin-directory-row"
              key={account.id}
            >
              <div>
                <strong>{account.name}</strong>

                <small>{account.email}</small>
              </div>

              <span
                className={
                  account.role === "super_admin"
                    ? "status pink"
                    : "status green"
                }
              >
                {account.role === "super_admin"
                  ? "Super Admin"
                  : "Admin"}
              </span>
            </div>
          ))}
        </div>

        <p className="muted">
          To remove an Admin account, go to
          Settings → Existing Admin Accounts.
        </p>
      </section>
    </div>
  );
}


import React, { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import Pagination, { usePagination } from "../components/Pagination";
import { readAuditLogs } from "../utils/auditLog";

const formatTime = value => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "short", day: "2-digit",
    hour: "numeric", minute: "2-digit", hour12: true
  });
};

const valueText = value => {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function ActivityLogs({ admin, auditRevision = 0 }) {
  const isCEO = admin?.role === "super_admin";
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isCEO) return;
    try {
      setLogs(readAuditLogs());
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    }
  }, [isCEO, auditRevision]);

  const modules = useMemo(() =>
    [...new Set(logs.map(log => log.module).filter(Boolean))].sort(), [logs]
  );
  const actors = useMemo(() => {
    const map = new Map();
    logs.forEach(log => map.set(log.actorId, log.actorName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const filtered = useMemo(() => logs.filter(log => {
    const searchable = `${log.actorName} ${log.actorId} ${log.action} ${log.module} ${log.subject} ${log.recordId}`.toLowerCase();
    const date = String(log.timestamp || "").slice(0, 10);
    // PH date filter uses Asia/Manila date rather than the UTC ISO date.
    const dayPH = log.timestamp ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date(log.timestamp)) : date;
    return searchable.includes(search.trim().toLowerCase()) &&
      (moduleFilter === "all" || log.module === moduleFilter) &&
      (actorFilter === "all" || log.actorId === actorFilter) &&
      (!from || dayPH >= from) && (!to || dayPH <= to);
  }), [logs, search, moduleFilter, actorFilter, from, to]);

  const paging = usePagination(filtered, 6);

  if (!isCEO) {
    return <div className="page-enter"><section className="panel">
      <h3>Super Admin access only ♛</h3>
      <p className="muted">Activity Logs are restricted to the CEO.</p>
    </section></div>;
  }

  function reload() {
    try {
      setLogs(readAuditLogs());
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    }
  }

  function resetFilter(callback, value) {
    callback(value);
    paging.resetPage();
  }

  function exportCSV() {
    if (!filtered.length) return;
    const csvCell = value => {
      let text = String(value == null ? "" : value);
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Timestamp (PH)", "Admin", "Admin ID", "Role", "Module", "Action", "Record ID", "Affected Record", "Changed Fields", "Reason"],
      ...filtered.map(log => [
        formatTime(log.timestamp), log.actorName, log.actorId, log.actorRole,
        log.module, log.action, log.recordId, log.subject,
        (log.changes || []).map(change =>
          `${change.field}: ${valueText(change.before)} => ${valueText(change.after)}`
        ).join(" | "), log.reason || ""
      ])
    ];
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "FHILAR-Activity-Logs.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-enter fhilar-audit-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">♛ EXECUTIVE OVERSIGHT</span>
          <h1>Activity Logs <span>♡</span></h1>
          <p>Know who changed what, and when — with before-and-after details.</p>
        </div>
        <span className="pill">{logs.length} recorded activities</span>
      </div>

      <section className="panel fhilar-audit-banner">
        <div>
          <span className="eyebrow">THE WORKPLACE AUDIT TRAIL</span>
          <h3>Every change has a story. ✿</h3>
          <p>Successful actions are automatically recorded. These logs cannot be edited or deleted through the FHILAR interface.</p>
        </div>
        <span className="fhilar-audit-decor" aria-hidden="true">♛ ✿ ♡</span>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ACTIVITY HISTORY</span>
            <h3>Administrator Actions</h3>
          </div>
          <div className="fhilar-audit-header-actions">
            <button className="btn btn-outline" type="button" onClick={reload}>↻ Refresh</button>
            <button className="btn btn-primary" type="button" onClick={exportCSV} disabled={!filtered.length}>Export CSV ↗</button>
          </div>
        </div>

        {loadError && <p className="fhilar-archive-readonly" role="alert">{loadError}</p>}

        <div className="toolbar fhilar-audit-filters">
          <label>
            Search
            <input placeholder="Search admin, action or record..." value={search}
              onChange={e => resetFilter(setSearch, e.target.value)} />
          </label>
          <label>
            Module
            <select value={moduleFilter} onChange={e => resetFilter(setModuleFilter, e.target.value)}>
              <option value="all">All modules</option>
              {modules.map(module => <option value={module} key={module}>{module}</option>)}
            </select>
          </label>
          <label>
            Administrator
            <select value={actorFilter} onChange={e => resetFilter(setActorFilter, e.target.value)}>
              <option value="all">All administrators</option>
              {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label>
            From (PH)
            <input type="date" value={from} onChange={e => resetFilter(setFrom, e.target.value)}/>
          </label>
          <label>
            To (PH)
            <input type="date" value={to} onChange={e => resetFilter(setTo, e.target.value)}/>
          </label>
        </div>

        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>ADMINISTRATOR</th>
              <th>ACTIVITY</th>
              <th>MODULE</th>
              <th>AFFECTED RECORD</th>
              <th>DATE & TIME (PH)</th>
              <th>DETAILS</th>
            </tr></thead>
            <tbody>
              {paging.pageItems.map(log => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.actorName}</strong>
                    <div className="muted">{log.actorRole} · {log.actorId}</div>
                  </td>
                  <td><span className="fhilar-audit-action">{log.action}</span></td>
                  <td>{log.module}</td>
                  <td>
                    <strong>{log.subject || "—"}</strong>
                    <div className="muted">{log.recordId || "—"}</div>
                  </td>
                  <td>{formatTime(log.timestamp)}</td>
                  <td><button type="button" className="text-button" onClick={() => setSelected(log)}>View Changes ↗</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="empty">{logs.length ? "No activities match these filters." : "Activity Logs are empty. New actions will appear here. ♡"}</p>}
        </div>
        <Pagination {...paging} />

        <p className="muted fhilar-audit-note">
          Audit events start when this feature is installed; older actions cannot be reconstructed reliably.
          This frontend-only localStorage history is not tamper-proof. For real fraud prevention, use a backend with server-enforced roles and append-only audit storage.
        </p>
      </section>

      {selected && <Modal title="Activity Details ♡" onClose={() => setSelected(null)}>
        <div className="fhilar-audit-detail">
          <p><strong>{selected.action}</strong> · {selected.module}</p>
          <p className="muted">
            By {selected.actorName} ({selected.actorRole})<br />
            Admin ID: {selected.actorId}<br />
            Date: {formatTime(selected.timestamp)}<br />
            Record: {selected.subject || selected.recordId}
          </p>
          {selected.reason && <p><strong>Reason:</strong> {selected.reason}</p>}
          <h4>Before & After Comparison</h4>
          {selected.changes?.length ? (
            <div className="fhilar-audit-changes">
              {selected.changes.map((change, index) => (
                <div className="fhilar-audit-change" key={`${change.field}-${index}`}>
                  <strong>{change.field}</strong>
                  <div className="fhilar-audit-compare">
                    <div><small>BEFORE</small><span>{valueText(change.before)}</span></div>
                    <div><small>AFTER</small><span>{valueText(change.after)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="muted">A successful action was recorded. There were no detailed field changes for this event.</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>Close ♡</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

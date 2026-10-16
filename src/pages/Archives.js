
import React, { useState } from "react";
import Pagination, { usePagination } from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { displayDateTime } from "../utils/payroll";

const FILTERS = [
  ["all", "All records"],
  ["attendance", "Attendance"],
  ["absence", "Absences"],
  ["leave", "Leaves"],
  ["payroll", "Payroll"],
  ["workspace", "Workspace backups"]
];

const TYPE_LABELS = {
  attendance: "Attendance",
  absence: "Absence",
  leave: "Leave Request",
  payroll: "Canceled Payroll",
  workspace: "Workspace Reset Backup"
};

export default function Archives({ data, admin, restoreArchive, permanentlyDeleteArchive }) {
  const isCEO = admin?.role === "super_admin";
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const entries = [...(data.archives || [])].sort((a, b) =>
    (b.deletedAt || "").localeCompare(a.deletedAt || "")
  );
  const shown = entries.filter(entry =>
    (filter === "all" || entry.type === filter) &&
    `${entry.label} ${entry.type} ${entry.deletedByName || ""}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const archivesPage = usePagination(shown);

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">NOT GONE, JUST TUCKED AWAY</span>
          <h1>Archives Studio <span>♡</span></h1>
          <p>Recently deleted company records can be reviewed and recovered here.</p>
        </div>
        <span className="pill">{entries.length} archived item{entries.length === 1 ? "" : "s"}</span>
      </div>

      <section className="panel fhilar-archive-intro">
        <div>
          <span className="eyebrow">A LITTLE SAFETY NET ✿</span>
          <h3>Even deleted records deserve a second chance.</h3>
          <p>
            Deleting eligible attendance, absence, or leave records moves them here.
            Canceled unpaid payroll runs are saved too. Nothing expires automatically:
            the CEO decides when to restore or permanently delete a record.
          </p>
        </div>
        <span className="fhilar-archive-art" aria-hidden="true">♡ ✿ ♡</span>
      </section>

      {!isCEO && (
        <p className="fhilar-archive-readonly">
          ♡ Admins can view archive history. Only the Super Admin can restore or permanently delete.
        </p>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">RECENTLY DELETED</span>
            <h3>Archived Records</h3>
          </div>
        </div>
        <div className="toolbar">
          <input
            placeholder="⌕ Search deleted records..."
            value={search}
            onChange={event => { setSearch(event.target.value); archivesPage.resetPage(); }}
          />
          <select aria-label="Archive type" value={filter} onChange={event => { setFilter(event.target.value); archivesPage.resetPage(); }}>
            {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>RECORD</th><th>TYPE</th><th>DELETED AT</th>
                <th>ARCHIVED BY</th><th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {archivesPage.pageItems.map(entry => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.label}</strong>
                    <div className="muted">Original ID: {entry.record?.id || "Workspace snapshot"}</div>
                  </td>
                  <td><span className="fhilar-archive-pill">{TYPE_LABELS[entry.type] || entry.type}</span></td>
                  <td>{displayDateTime(entry.deletedAt)}</td>
                  <td>{entry.deletedByName || "Administrator"}</td>
                  <td>
                    {isCEO ? (
                      <div className="table-actions fhilar-archive-actions">
                        <button className="text-button" onClick={() => setRestoring(entry)}>↻ Restore</button>
                        <button className="text-button danger-text" onClick={() => setDeleting(entry)}>
                          Permanently Delete
                        </button>
                      </div>
                    ) : <small className="muted">CEO only</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <p className="empty">
              {entries.length ? "No archive entries match your search." : "Your Archives are empty. Nothing has been deleted yet. ♡"}
            </p>
          )}
        </div>
        <Pagination {...archivesPage} />
        <p className="muted fhilar-archive-note">
          Restore checks for conflicts with attendance, leave, and payroll before recovering a record.
          A restored canceled payroll returns as Draft. Restoring a workspace backup requires an empty workspace.
          Permanent deletion cannot be undone. Archives are stored only in this browser's localStorage.
        </p>
      </section>

      {restoring && (
        <ConfirmDialog
          title="Bring this record back? ♡"
          message={`Restore “${restoring.label}” to its original FHILAR module? The system will first check for conflicting records.`}
          confirmLabel="Yes, Restore ✿"
          onClose={() => setRestoring(null)}
          onConfirm={() => restoreArchive(restoring.id)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Permanently delete this record?"
          message={`“${deleting.label}” will be removed from Archives and cannot be recovered. This is irreversible.`}
          confirmLabel="Delete Forever"
          danger
          requirePhrase="DELETE"
          onClose={() => setDeleting(null)}
          onConfirm={() => permanentlyDeleteArchive(deleting.id)}
        />
      )}
    </div>
  );
}

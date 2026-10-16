
import React, { useState } from "react";
import Pagination, { usePagination } from "./Pagination";
import Modal from "./Modal";

import {
  displayDateTime,
  displayDate,
  phDate
} from "../utils/payroll";

import {
  lateForRecord
} from "../utils/attendanceRules";



export default function CutoffReviews({
  data,
  admin,
  submitCutoffExplanation,
  decideCutoffReview,
  reopenCutoffReview
}) {
  const [filter, setFilter] = useState("Pending");
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");

  const isCEO = admin?.role === "super_admin";

  const reviews = data.cutoffReviews || [];

  const findReview = id =>
    reviews.find(
      review => review.attendanceId === id
    );

  const employees = data.employees || [];

  const nameOf = id =>
    employees.find(
      employee => employee.id === id
    )?.name || id;

  

  const flagged = [...data.attendance]
    .map(record => ({
      record,
      late: lateForRecord(
        record,
        data.settings
      )
    }))
    .filter(
      item => item.late.minutesLate >= 60
    )
    .sort(
      (a, b) =>
        Date.parse(b.record.timeIn) -
        Date.parse(a.record.timeIn)
    );

  

  const pending = flagged.filter(
    item =>
      (
        findReview(item.record.id)?.status ||
        "Pending"
      ) === "Pending"
  ).length;

  const excused = flagged.filter(
    item =>
      findReview(item.record.id)?.status ===
      "Excused"
  ).length;

  const confirmed = flagged.filter(
    item =>
      findReview(item.record.id)?.status ===
      "Confirmed"
  ).length;

  

  const shown = flagged.filter(item =>
    filter === "all" ||
    (
      findReview(item.record.id)?.status ||
      "Pending"
    ) === filter
  );

  

  const cutoffPage = usePagination(shown);

  function showDialog(record, mode) {
    const existing = findReview(record.id);

    setNote(
      mode === "explanation"
        ? existing?.explanation || ""
        : ""
    );

    setDialog({
      recordId: record.id,
      mode
    });
  }

  

  function handleSubmit(event) {
    event.preventDefault();

    if (!dialog) return;

    let saved = false;

    if (dialog.mode === "explanation") {
      saved = submitCutoffExplanation(
        dialog.recordId,
        note
      );
    } else if (dialog.mode === "reopen") {
      saved = reopenCutoffReview(
        dialog.recordId,
        note
      );
    } else {
      saved = decideCutoffReview(
        dialog.recordId,
        dialog.mode,
        note
      );
    }

    if (saved) {
      setDialog(null);
      setNote("");
    }
  }

  const dialogTitle =
    dialog?.mode === "explanation"
      ? "Share a workday explanation ♡"
      : dialog?.mode === "Excused"
      ? "Accept the explanation? ✿"
      : dialog?.mode === "Confirmed"
      ? "Confirm the cutoff violation?"
      : "Reopen this CEO review? ♡";

  return (
    <section
      className="panel cutoff-review-panel"
      id="fhilar-cutoff-reviews"
    >

      {}

      <div className="panel-heading cutoff-review-heading">
        <div>
          <span className="eyebrow">
            CEO ATTENDANCE REVIEW
          </span>

          <h3>
            60-Minute Cutoff Reviews ♡
          </h3>

          <p className="muted">
            A separate review record for late
            arrivals of one hour or more.
          </p>
        </div>

        <span className="pill">
          {pending} pending
        </span>
      </div>

      {}

      <div className="cutoff-review-counters">
        <div>
          <strong>{pending}</strong>
          <span>Pending review</span>
        </div>

        <div>
          <strong>{excused}</strong>
          <span>Excused</span>
        </div>

        <div>
          <strong>{confirmed}</strong>
          <span>Confirmed</span>
        </div>
      </div>

      {}

      <div className="toolbar">
        <label>
          Review status

          <select
            value={filter}
            onChange={e =>
              { setFilter(e.target.value); cutoffPage.resetPage(); }
            }
          >
            <option value="Pending">
              Pending review
            </option>

            <option value="all">
              All flagged records
            </option>

            <option value="Excused">
              Excused
            </option>

            <option value="Confirmed">
              Confirmed violation
            </option>
          </select>
        </label>
      </div>

      {}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>EMPLOYEE</th>
              <th>WORK DATE</th>
              <th>TIME IN</th>
              <th>MINUTES LATE</th>
              <th>ATTENDANCE / PAYROLL</th>
              <th>CEO REVIEW</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {cutoffPage.pageItems.map(({ record, late }) => {
              const review = findReview(
                record.id
              );

              const status =
                review?.status || "Pending";

              const run = data.runs.find(
                payroll =>
                  payroll.id === record.payrollId
              );

              return (
                <tr key={record.id}>
                  <td>
                    <strong>
                      {nameOf(record.employeeId)}
                    </strong>

                    <div className="muted">
                      {record.employeeId}
                    </div>
                  </td>

                  <td>
                    {displayDate(
                      late.scheduledDate ||
                      phDate(new Date(record.timeIn))
                    )}
                  </td>

                  <td>
                    {displayDateTime(record.timeIn)}
                  </td>

                  <td>
                    <strong>
                      {late.minutesLate} min
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`status ${
                        record.status === "Approved"
                          ? "green"
                          : "pink"
                      }`}
                    >
                      {record.status}
                    </span>

                    {record.payrollId && (
                      <div className="muted">
                        Locked ·{" "}
                        {run?.status || "Payroll run"}
                      </div>
                    )}
                  </td>

                  <td>
                    <span
                      className={`fhilar-cutoff-status ${
                        status.toLowerCase()
                      }`}
                    >
                      {status === "Pending"
                        ? "Pending CEO review"
                        : status === "Excused"
                        ? "Excused"
                        : "Confirmed violation"}
                    </span>

                    {review?.explanation && (
                      <div className="cutoff-review-small">
                        Explanation:{" "}
                        {review.explanation}
                      </div>
                    )}

                    {review?.decisionNote && (
                      <div className="cutoff-review-small">
                        CEO note:{" "}
                        {review.decisionNote}
                      </div>
                    )}

                    {review?.reviewedAt && (
                      <div className="cutoff-review-small">
                        Reviewed by{" "}
                        {review.reviewedByName || "CEO"}
                        {" · "}
                        {displayDateTime(
                          review.reviewedAt
                        )}
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="table-actions cutoff-review-actions">

                      {}

                      {status === "Pending" && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            showDialog(
                              record,
                              "explanation"
                            )
                          }
                        >
                          ✿{" "}
                          {review?.explanation
                            ? "Edit Explanation"
                            : "Add Explanation"}
                        </button>
                      )}

                      {}

                      {isCEO &&
                        status === "Pending" && (
                          <>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() =>
                                showDialog(
                                  record,
                                  "Excused"
                                )
                              }
                            >
                              Excuse
                            </button>

                            <button
                              type="button"
                              className="text-button danger-text"
                              onClick={() =>
                                showDialog(
                                  record,
                                  "Confirmed"
                                )
                              }
                            >
                              Confirm Violation
                            </button>
                          </>
                        )}

                      {}

                      {isCEO &&
                        status !== "Pending" && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              showDialog(
                                record,
                                "reopen"
                              )
                            }
                          >
                            Reopen Review
                          </button>
                        )}

                      {!isCEO &&
                        status !== "Pending" && (
                          <small className="muted">
                            CEO decision saved
                          </small>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!shown.length && (
          <p className="empty">
            {flagged.length
              ? "No records in this review status."
              : "No 60+ minute arrivals recorded yet. ♡"}
          </p>
        )}
      </div>
      <Pagination {...cutoffPage} />

      <p className="muted cutoff-review-footer">
        CEO decisions are recorded for classroom
        attendance review only. They do not change
        worked hours, existing payroll amounts,
        or paid payroll records. Payroll corrections
        require a separate authorized process.
      </p>

      {}

      {dialog && (
        <Modal
          title={dialogTitle}
          onClose={() =>
            setDialog(null)
          }
        >
          <form
            className="form-grid"
            onSubmit={handleSubmit}
          >
            <p className="muted full">
              {dialog.mode === "explanation"
                ? "Provide a short, work-related explanation for the late arrival. Avoid sensitive personal details."
                : dialog.mode === "Excused"
                ? "The cutoff will be documented as excused. This doesn't change the original clock-in or payroll."
                : dialog.mode === "Confirmed"
                ? "Confirm the FHILAR classroom cutoff violation. Hours actually worked stay payable."
                : "This returns the record to Pending CEO Review and keeps its decision history."}
            </p>

            <label className="full">
              {dialog.mode === "explanation"
                ? "Explanation"
                : "CEO review note"}

              <textarea
                className="cutoff-review-textarea"
                rows={3}
                maxLength={300}
                required={
                  dialog.mode !== "Excused"
                }
                value={note}
                onChange={e =>
                  setNote(e.target.value)
                }
                placeholder={
                  dialog.mode === "explanation"
                    ? "Brief workday explanation"
                    : "Reason for this decision"
                }
              />
            </label>

            <div className="modal-actions full">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  setDialog(null)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                {dialog.mode === "explanation"
                  ? "Save Explanation ♡"
                  : dialog.mode === "Excused"
                  ? "Yes, Excuse ✿"
                  : dialog.mode === "Confirmed"
                  ? "Confirm Violation"
                  : "Reopen Review ♡"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

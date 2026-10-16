
import React, { useState } from "react";
import Modal from "./Modal";

// Reusable pink/sage confirmation instead of the browser's window.confirm().
// requirePhrase="DELETE" adds deliberate confirmation for irreversible deletion.
export default function ConfirmDialog({
  title = "Are you sure? ♡",
  message,
  confirmLabel = "Yes, continue ✿",
  onConfirm,
  onClose,
  danger = false,
  requirePhrase = ""
}) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !requirePhrase || phrase === requirePhrase;

  function confirm() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const result = onConfirm();
      if (result !== false) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="A little confirmation ♡" onClose={onClose}>
      <div className="fhilar-confirm">
        <div className={`fhilar-confirm-symbol ${danger ? "is-danger" : ""}`} aria-hidden="true">
          {danger ? "♡" : "✿"}
        </div>
        <h3>{title}</h3>
        <p>{message}</p>
        {requirePhrase && (
          <label className="fhilar-confirm-phrase">
            Type <strong>{requirePhrase}</strong> to confirm permanent deletion
            <input
              value={phrase}
              autoComplete="off"
              onChange={event => setPhrase(event.target.value)}
              placeholder={requirePhrase}
            />
          </label>
        )}
        <div className="modal-actions fhilar-confirm-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Keep It ♡
          </button>
          <button
            type="button"
            className={`btn ${danger ? "fhilar-danger-button" : "btn-primary"}`}
            disabled={!ready || busy}
            onClick={confirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

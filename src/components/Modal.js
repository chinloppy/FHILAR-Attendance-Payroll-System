import React, { useEffect } from "react";
export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    const escape = event => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></header>
      {children}
    </section></div>;
}

import React from 'react';

export default function ConfirmDialog({ title, message, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen', danger, onConfirm, onCancel }) {
  return (
    <>
      <div className="scrim" onClick={onCancel}></div>
      <div className="dialog">
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={'btn ' + (danger ? 'btn-rust' : 'btn-primary')} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

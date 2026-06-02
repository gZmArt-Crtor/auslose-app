import React from 'react';
import { useBackToClose } from '../hooks/useBackToClose.js';

export default function ExportReadyDialog({ filename, onShare, onDownload, onCancel }) {
  useBackToClose(true, onCancel);

  return (
    <>
      <div className="scrim" onClick={onCancel}></div>
      <div className="dialog">
        <h4>Excel bereit</h4>
        <p>
          <strong style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{filename}</strong>
          <br />
          Zum Teilen (WhatsApp, E-Mail, …) unten auf <em>Teilen</em> tippen — der System-Dialog öffnet sich erst dann.
        </p>
        <div className="actions export-ready-actions">
          <button type="button" className="btn btn-primary" onClick={onShare}>Teilen</button>
          <button type="button" className="btn btn-ghost" onClick={onDownload}>Herunterladen</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Schließen</button>
        </div>
      </div>
    </>
  );
}

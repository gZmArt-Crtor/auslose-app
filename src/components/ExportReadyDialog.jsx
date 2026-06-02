import React from 'react';
import { useBackToClose } from '../hooks/useBackToClose.js';

export default function ExportReadyDialog({ filename, canShareCsv, onShareCsv, onSaveExcel, onCancel }) {
  useBackToClose(true, onCancel);

  return (
    <>
      <div className="scrim" onClick={onCancel}></div>
      <div className="dialog">
        <h4>Export bereit</h4>
        <p>
          <strong style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{filename}</strong>
          <br />
          Chrome kann die Excel-Vorlage nicht direkt teilen. Für den offiziellen Stundenzettel: <em>Excel speichern</em>
          {canShareCsv ? (
            <> — danach in der Dateien-App an WhatsApp senden, oder <em>CSV teilen</em> für eine schnelle Übersicht per WhatsApp.</>
          ) : (
            <> — danach in der Dateien-App an WhatsApp senden.</>
          )}
        </p>
        <div className="actions export-ready-actions">
          <button type="button" className="btn btn-primary" onClick={onSaveExcel}>Excel speichern</button>
          {canShareCsv && (
            <button type="button" className="btn btn-ghost" onClick={onShareCsv}>CSV teilen (WhatsApp)</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Schließen</button>
        </div>
      </div>
    </>
  );
}

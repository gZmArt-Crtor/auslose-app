import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { WEEKDAYS, MONTHS } from './config/constants.js';
import { computeHours, blankEntry, entryToTimeString, daysInMonth, siteWithAusfall } from './lib/hours.js';
import { isHoliday } from './lib/holidays.js';
import {
  buildExportBlob, exportFilename, downloadExportBlob, shareExportBlob, canUseWebShare,
} from './lib/export.js';
import {
  loadState, saveState, monthKey, blankMonth,
  serializeBackup, backupFilename, parseBackup,
} from './lib/storage.js';
import { APP_VERSION } from './version.js';
import DayEditor from './components/DayEditor.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ExportReadyDialog from './components/ExportReadyDialog.jsx';

export default function App() {
  const [state, setState] = useState(loadState);
  const [editDay, setEditDay] = useState(null);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState(null);
  const [exportReady, setExportReady] = useState(null);
  const importRef = useRef();

  useEffect(() => { saveState(state); }, [state]);

  const closeEditor = useCallback(() => setEditDay(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  useEffect(() => {
    const open = editDay != null || dialog != null || exportReady != null;
    document.body.classList.toggle('modal-open', open);
    return () => document.body.classList.remove('modal-open');
  }, [editDay, dialog, exportReady]);

  const numDays = daysInMonth(state.month, state.year);
  const key = monthKey(state.year, state.month);
  const bucket = state.months[key] || blankMonth();
  const entries = bucket.entries;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const total = useMemo(() => {
    let t = 0;
    for (let d = 1; d <= numDays; d++) {
      const e = entries[d];
      if (e) t += computeHours(e);
    }
    return Math.round(t * 100) / 100;
  }, [entries, numDays]);

  const ausGuthaben = parseFloat(bucket.ausGuthaben) || 0;
  const zuGuthaben = parseFloat(bucket.zuGuthaben) || 0;
  const abrechnung = Math.round((total + ausGuthaben - zuGuthaben) * 100) / 100;

  function weekdayFor(day) {
    return WEEKDAYS[new Date(state.year, state.month, day).getDay()];
  }

  function updateBucket(updater) {
    setState(s => {
      const k = monthKey(s.year, s.month);
      const cur = s.months[k] || blankMonth();
      const draft = { ...cur, entries: { ...cur.entries } };
      const next = updater(draft);
      return { ...s, months: { ...s.months, [k]: next } };
    });
  }

  function saveDays(day, entry, extraDays) {
    updateBucket(b => {
      b.entries[day] = entry;
      (extraDays || []).forEach(d => { b.entries[d] = { ...entry }; });
      return b;
    });
  }

  function clearEntry(day) {
    updateBucket(b => { delete b.entries[day]; return b; });
  }

  function setGuthaben(field, val) {
    updateBucket(b => { b[field] = val; return b; });
  }

  function clearMonth() {
    updateBucket(() => blankMonth());
    setDialog(null);
    showToast('Monat geleert');
  }

  function downloadBackup() {
    try {
      const blob = new Blob([serializeBackup(state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename();
      a.click();
      URL.revokeObjectURL(url);
      showToast('Sicherung erstellt ✓');
    } catch {
      showToast('Sicherung fehlgeschlagen');
    }
  }

  function onImportFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseBackup(String(reader.result));
        setDialog({ type: 'import', imported });
      } catch {
        showToast('Ungültige Sicherungsdatei');
      }
    };
    reader.readAsText(file);
  }

  function doImport(imported) {
    setState(imported);
    setDialog(null);
    showToast('Daten wiederhergestellt ✓');
  }

  const exportParams = useMemo(() => ({
    name: state.name, pkw: state.pkw, month: state.month, year: state.year,
    numDays, entries, ausGuthaben: bucket.ausGuthaben, zuGuthaben: bucket.zuGuthaben,
  }), [state.name, state.pkw, state.month, state.year, numDays, entries, bucket.ausGuthaben, bucket.zuGuthaben]);

  async function runExport() {
    showToast('Exportiere…');
    try {
      const blob = await buildExportBlob(exportParams);
      const filename = exportFilename(exportParams);
      if (canUseWebShare()) {
        setExportReady({ blob, filename });
        showToast('Bereit — Teilen oder Herunterladen');
      } else {
        downloadExportBlob(blob, filename);
        showToast('Excel heruntergeladen ✓');
      }
    } catch (err) {
      showToast('Fehler: ' + err.message);
    }
  }

  async function onExportShare() {
    if (!exportReady) return;
    const { blob, filename } = exportReady;
    try {
      await shareExportBlob(blob, filename);
      setExportReady(null);
      showToast('Geteilt ✓');
    } catch (err) {
      if (err.name === 'AbortError') return;
      downloadExportBlob(blob, filename);
      setExportReady(null);
      showToast('Teilen nicht möglich — Datei gespeichert');
    }
  }

  function onExportDownload() {
    if (!exportReady) return;
    downloadExportBlob(exportReady.blob, exportReady.filename);
    setExportReady(null);
    showToast('Excel heruntergeladen ✓');
  }

  function onExportClick() {
    if (!String(state.name || '').trim()) {
      setDialog({ type: 'exportNoName' });
      return;
    }
    runExport();
  }

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <h1>Auslöse</h1>
          <span className="tag">Stundenzettel</span>
          <span style={{ marginLeft: 'auto', fontFamily: '\'DM Mono\',monospace', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '1px' }}>v{APP_VERSION}</span>
        </div>
        <div className="monthrow">
          <div className="field" style={{ flex: 2 }}>
            <label>Name</label>
            <input value={state.name} onChange={e => setState(s => ({ ...s, name: e.target.value }))} placeholder="Vor- und Nachname" autoComplete="off" autoCorrect="off" spellCheck="false" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>PKW-Kennzeichen</label>
            <input value={state.pkw || ''} onChange={e => setState(s => ({ ...s, pkw: e.target.value }))} placeholder="z.B. HO-AB 123" autoComplete="off" autoCorrect="off" spellCheck="false" style={{ textTransform: 'uppercase' }} />
          </div>
        </div>
        <div className="monthrow">
          <div className="field">
            <label>Monat</label>
            <select value={state.month} onChange={e => setState(s => ({ ...s, month: +e.target.value }))}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Jahr</label>
            <input type="number" value={state.year} onChange={e => setState(s => ({ ...s, year: +e.target.value }))} autoComplete="off" />
          </div>
        </div>
      </div>

      <div className="daygrid">
        {Array.from({ length: numDays }, (_, i) => i + 1).map(day => {
          const e = entries[day];
          const wd = weekdayFor(day);
          const isWeekend = wd === 'Sa' || wd === 'So';
          const isFeier = e && e.special === 'sfpa';
          const holiday = isHoliday(state.year, state.month, day);
          const hrs = e ? computeHours(e) : 0;
          const siteLabel = e ? siteWithAusfall(e) || e.site : '';
          let metaParts = [];
          if (e) {
            if (e.bst) metaParts.push('Bst ' + e.bst);
            const ts = entryToTimeString(e);
            if (ts) metaParts.push(ts);
          }
          return (
            <div key={day}
              className={'daycard ' + (e ? 'filled ' : '') + (isWeekend ? 'weekend ' : '') + (isFeier ? 'feier ' : '') + (holiday ? 'holiday' : '')}
              onClick={() => setEditDay(day)}>
              <div className="daynum">{day}</div>
              <div className="dayinfo">
                <div className="wd">{wd}{holiday && <span className="holtag">Feiertag</span>}</div>
                <div className={'site ' + (e && siteLabel ? '' : 'empty')}>{e && siteLabel ? siteLabel : 'leer — tippen zum Eintragen'}</div>
                {metaParts.length > 0 && <div className="meta">{metaParts.join('  ·  ')}{e.auslose ? <span>  ·  Auslöse {e.auslose}</span> : null}</div>}
              </div>
              {hrs > 0 && <div className="hourspill">{hrs}h</div>}
            </div>
          );
        })}
      </div>

      <div className="totals">
        <h2>Abrechnung</h2>
        <div className="totrow"><span className="lbl">Gesamtstunden</span><span className="val big">{total}</span></div>
        <div className="totrow">
          <span className="lbl">Stunden aus Guthaben +</span>
          <input type="number" inputMode="decimal" placeholder="0" value={bucket.ausGuthaben || ''} onChange={e => setGuthaben('ausGuthaben', e.target.value)} onFocus={e => e.target.select()} autoComplete="off" />
        </div>
        <div className="totrow">
          <span className="lbl">Stunden zu Guthaben −</span>
          <input type="number" inputMode="decimal" placeholder="0" value={bucket.zuGuthaben || ''} onChange={e => setGuthaben('zuGuthaben', e.target.value)} onFocus={e => e.target.select()} autoComplete="off" />
        </div>
        <div className="totrow">
          <span className="lbl">Stunden zur Abrechnung</span>
          <span className="val big" style={{ color: 'var(--gold)' }}>{abrechnung}</span>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={onExportClick}>↓ Excel exportieren / teilen</button>
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={downloadBackup}>Daten sichern</button>
        <button className="btn btn-ghost" onClick={() => importRef.current.click()}>Wiederherstellen</button>
        <input ref={importRef} type="file" accept="application/json,.json" className="hide" onChange={ev => { if (ev.target.files[0]) onImportFile(ev.target.files[0]); ev.target.value = ''; }} />
      </div>
      <div className="actions">
        <button className="btn btn-ghost" onClick={() => setDialog({ type: 'clear' })}>Monat leeren</button>
      </div>

      <div className="footer">RenPG</div>

      {editDay && (
        <DayEditor
          day={editDay}
          numDays={numDays}
          year={state.year}
          month={state.month}
          weekday={weekdayFor(editDay)}
          weekdayFor={weekdayFor}
          entry={entries[editDay] || blankEntry()}
          existing={!!entries[editDay]}
          onClose={closeEditor}
          onSave={(en, extraDays) => {
            saveDays(editDay, en, extraDays);
            const cnt = 1 + (extraDays || []).length;
            setEditDay(null);
            showToast(cnt > 1 ? `${cnt} Tage gespeichert` : `Tag ${editDay} gespeichert`);
          }}
          onClear={() => { clearEntry(editDay); setEditDay(null); showToast('Tag ' + editDay + ' geleert'); }}
        />
      )}

      {dialog && dialog.type === 'clear' && (
        <ConfirmDialog
          title="Monat leeren?"
          message={`Alle Einträge sowie Guthaben für ${MONTHS[state.month]} ${state.year} werden gelöscht. Andere Monate bleiben erhalten.`}
          confirmLabel="Leeren" danger
          onConfirm={clearMonth} onCancel={closeDialog}
        />
      )}
      {dialog && dialog.type === 'import' && (
        <ConfirmDialog
          title="Daten wiederherstellen?"
          message="Alle Daten auf diesem Gerät werden durch die Sicherung ersetzt. Fortfahren?"
          confirmLabel="Ersetzen" danger
          onConfirm={() => doImport(dialog.imported)} onCancel={closeDialog}
        />
      )}
      {dialog && dialog.type === 'exportNoName' && (
        <ConfirmDialog
          title="Kein Name eingetragen"
          message="Es ist kein Name eingetragen. Möchtest du den Stundenzettel trotzdem exportieren?"
          confirmLabel="Trotzdem exportieren"
          onConfirm={() => { setDialog(null); runExport(); }} onCancel={closeDialog}
        />
      )}

      {exportReady && (
        <ExportReadyDialog
          filename={exportReady.filename}
          onShare={onExportShare}
          onDownload={onExportDownload}
          onCancel={() => setExportReady(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

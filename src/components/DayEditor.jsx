import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { ROLES } from '../config/constants.js';
import { isHoliday } from '../lib/holidays.js';
import { shiftHours, blankEntry, specialEntry, normalizeEntry, isPureSpecial } from '../lib/hours.js';
import { useBackToClose } from '../hooks/useBackToClose.js';
import { useSheetSwipe } from '../hooks/useSheetSwipe.js';

export default function DayEditor({ day, numDays, year, month, weekday, weekdayFor, entry, existing, onClose, onSave, onClear }) {
  const sheetRef = useRef(null);
  useBackToClose(true, onClose);
  useSheetSwipe(onClose, sheetRef);

  const [e, setE] = useState(() => (isPureSpecial(entry) ? normalizeEntry(entry) : entry));
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProg, setOcrProg] = useState('');
  const [extraDays, setExtraDays] = useState([]);
  const fileRef = useRef();
  const upd = (k, v) => setE(p => ({ ...p, [k]: v }));
  const toggleDay = (d) => setExtraDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const dayIsHoliday = isHoliday(year, month, day);

  async function runOCR(file) {
    setOcrBusy(true); setOcrProg('Lade OCR…');
    try {
      const { data } = await Tesseract.recognize(file, 'deu', {
        logger: m => { if (m.status === 'recognizing text') setOcrProg('Erkenne Text… ' + Math.round(m.progress * 100) + '%'); },
      });
      const text = data.text;
      const timeM = text.replace(/\s/g, '').match(/(\d{1,2}[.:]\d{2})-(\d{1,2}[.:]\d{2})/);
      const tpM = text.match(/TP[:\s]+(?:Bf\.?\s*)?([A-Za-zÄÖÜäöüß\-\/ ]{3,40})/);
      const next = { ...e };
      if (timeM) {
        const [sh, sm] = timeM[1].replace(':', '.').split('.');
        const [eh, em] = timeM[2].replace(':', '.').split('.');
        next.startH = sh; next.startM = (sm || '00').padEnd(2, '0');
        next.endH = eh; next.endM = (em || '00').padEnd(2, '0');
      }
      if (tpM) next.site = tpM[1].trim().replace(/\s*\/.*$/, '');
      const bstLine = text.match(/(\d{2,3})\s*$/m);
      if (bstLine) next.bst = bstLine[1];
      setE(next);
      setOcrProg('Fertig — bitte prüfen ✓');
    } catch {
      setOcrProg('Fehler beim Lesen');
    }
    setOcrBusy(false);
  }

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true"></div>
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-handle">
          <div className="grab" aria-hidden="true"></div>
          <p className="sheet-hint">Nach unten wischen zum Schließen</p>
        </div>
        <h3 id="sheet-title">Tag {day}</h3>
        <div className="sub">{weekday} · {existing ? 'bearbeiten' : 'neuer Eintrag'}{dayIsHoliday ? ' · Feiertag' : ''}</div>

        {dayIsHoliday && !e.special && (
          <div style={{ marginTop: 2, marginBottom: 12, padding: '9px 12px', background: 'rgba(193,89,46,0.14)', borderRadius: 10, border: '1px solid var(--rust)', fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--rust)' }}>
            🎉 Gesetzlicher Feiertag (Bayern) — „Feiertag" wählen oder gearbeitete Zeit eintragen (Zuschlag automatisch).
          </div>
        )}

        <div className={'ocrbox ' + (ocrBusy ? 'busy' : '')} onClick={() => !ocrBusy && fileRef.current.click()}>
          {ocrBusy ? <>📷 {ocrProg}</> : <>📷 Dispo-Screenshot scannen (optional)<br /><span style={{ fontSize: 11 }}>tippen zum Auswählen — füllt Felder vor</span></>}
          <input ref={fileRef} type="file" accept="image/*" className="hide" onChange={ev => { if (ev.target.files[0]) runOCR(ev.target.files[0]); }} />
          {ocrProg && !ocrBusy && <div className="ocrprog">{ocrProg}</div>}
        </div>

        <div className="chips">
          <div className={'chip rust ' + (e.special === 'sfpa' ? 'on' : '')} onClick={() => {
            if (e.special === 'sfpa') setE(blankEntry());
            else setE(specialEntry('sfpa', 'Feiertag'));
          }}>Feiertag</div>
          <div className={'chip ' + (e.special === 'schulung' ? 'on' : '')} onClick={() => {
            if (e.special === 'schulung') setE(blankEntry());
            else setE(specialEntry('schulung', 'Schulung'));
          }}>Schulung</div>
          <div className={'chip ' + (e.special === 'bahnarzt' ? 'on' : '')} onClick={() => {
            if (e.special === 'bahnarzt') setE(blankEntry());
            else setE(specialEntry('bahnarzt', 'Bahnarzt'));
          }}>Bahnarzt</div>
          <div className={'chip ' + (e.special === 'urlaub' ? 'on' : '')} onClick={() => {
            if (e.special === 'urlaub') setE(blankEntry());
            else setE(specialEntry('urlaub', 'Urlaub'));
          }}>Urlaub</div>
          <div className={'chip ' + (e.special === 'krank' ? 'on' : '')} onClick={() => {
            if (e.special === 'krank') setE(blankEntry());
            else setE(specialEntry('krank', 'Krank'));
          }}>Krank</div>
          <div className={'chip ' + (e.special === 'ausfall' ? 'on' : '')} onClick={() => {
            if (e.special === 'ausfall') setE(blankEntry());
            else setE(specialEntry('ausfall', 'Ausfallschicht'));
          }}>Ausfallschicht</div>
        </div>
        <div className="roleinfo" style={{ marginTop: 6 }}>
          Feiertagknopf = gesetzlicher Feiertag <b>ohne</b> Arbeitszeit, normale 8h in S/F/P/A Spalte. Wenn gearbeitet wurde normale Arbeitszeit eintragen, Feiertag sollte automatisch erkannt werden.
          <br />
          Ausfallschicht + Ersatzschicht = Zeiten eintragen, ganz unten auf Doppelschicht und + Ausfallschichtknopf drücken.
        </div>

        {e.special ? (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--panel)', borderRadius: 12, border: '1px solid var(--line)' }}>
            <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4 }}>Wird eingetragen:</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{e.site}</div>
            <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--gold)', marginTop: 4 }}>
              8h → {e.special === 'urlaub' ? 'Urlaub (L)' : e.special === 'krank' ? 'Krank (M)' : e.special === 'ausfall' ? 'Sipo (F)' : 'S/F/P/A (K)'}
            </div>
          </div>
        ) : (
          <>
            {(() => {
              if (!e.startH || !e.endH) return null;
              const start = (+e.startH) + (+e.startM || 0) / 60;
              const end0 = (+e.endH) + (+e.endM || 0) / 60;
              const end = end0 <= start ? end0 + 24 : end0;

              const todayHol = isHoliday(year, month, day);
              const nextHol = isHoliday(year, month, day + 1);

              let feierStart = null, feierEnd = null;
              if (todayHol) { feierStart = start; feierEnd = Math.min(end, 24); }
              if (nextHol && end > 24) {
                if (feierStart === null) { feierStart = 24; feierEnd = end; }
                else feierEnd = end;
              }

              const nightStart = 22, nightEnd = 30;
              const nStart = Math.max(start, nightStart);
              const nEnd = Math.min(end, nightEnd);
              const hasNight = nEnd > nStart;

              if (!feierStart && !hasNight) return null;

              const fmt = (h) => {
                const hh = Math.floor(h % 24); const mm = Math.round((h % 1) * 60);
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
              };

              return (
                <div style={{ marginTop: 12, padding: '9px 12px', background: 'rgba(224,164,67,0.12)', borderRadius: 10, border: '1px solid var(--gold-soft)', fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--gold)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {feierStart !== null && feierEnd > feierStart && (
                    <span>🎉 Feiertagszuschlag: {fmt(feierStart)} – {fmt(feierEnd)} ({Math.round((feierEnd - feierStart) * 100) / 100}h) → Zuschläge F</span>
                  )}
                  {hasNight && (
                    <span>🌙 Nachtzuschlag: {fmt(nStart)} – {fmt(nEnd)} ({Math.round((nEnd - nStart) * 100) / 100}h) → NA</span>
                  )}
                </div>
              );
            })()}
            <div className="formgrid" style={{ marginTop: 12 }}>
              <div className="full field"><label>Baustelle</label><input value={e.site} onChange={ev => upd('site', ev.target.value)} placeholder="z.B. Marktleuthen" onFocus={ev => ev.target.select()} autoComplete="off" autoCorrect="off" spellCheck="false" /></div>
              <div className="field"><label>Bst.-Nr.</label><input inputMode="numeric" value={e.bst} onChange={ev => upd('bst', ev.target.value)} placeholder="134" onFocus={ev => ev.target.select()} autoComplete="off" autoCorrect="off" spellCheck="false" /></div>
            </div>

            <div className="field" style={{ marginTop: 11 }}>
              <label>Auslöse</label>
              <div className="chips">
                {[['', 'Keine'], ['14', '14 €'], ['28', '28 €']].map(([val, lbl]) => (
                  <div key={val} className={'chip ' + (e.auslose === val ? 'on' : '')} onClick={() => upd('auslose', val)}>{lbl}</div>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginTop: 11 }}>
              <label>Startzeit</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={e.startH || '7'} onChange={ev => upd('startH', ev.target.value)} style={{ flex: 1 }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                </select>
                <span style={{ color: 'var(--ink-faint)', fontFamily: 'DM Mono,monospace' }}>:</span>
                <select value={e.startM || '00'} onChange={ev => upd('startM', ev.target.value)} style={{ flex: 1 }}>
                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="field" style={{ marginTop: 11 }}>
              <label>Endzeit</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={e.endH || '15'} onChange={ev => upd('endH', ev.target.value)} style={{ flex: 1 }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                </select>
                <span style={{ color: 'var(--ink-faint)', fontFamily: 'DM Mono,monospace' }}>:</span>
                <select value={e.endM || '30'} onChange={ev => upd('endM', ev.target.value)} style={{ flex: 1 }}>
                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="field" style={{ marginTop: 11 }}>
              <label>Pause</label>
              <div className="chips">
                {[['0.5', '30 min'], ['0.75', '45 min'], ['1', '60 min']].map(([val, lbl]) => (
                  <div key={val} className={'chip ' + (e.pause === val ? 'on' : '')} onClick={() => upd('pause', val)}>{lbl}</div>
                ))}
              </div>
            </div>

            <div className="roleinfo" style={{ marginTop: 11 }}>Tätigkeit → Spalte für die Stunden:</div>
            <div className="chips">
              {ROLES.map(r => (
                <div key={r.key} className={'chip ' + (e.role === r.key ? 'on' : '')} onClick={() => upd('role', r.key)}>{r.label}</div>
              ))}
            </div>
            {shiftHours(e.startH, e.startM, e.endH, e.endM, e.pause) > 0 && <div className="calcnote">→ {shiftHours(e.startH, e.startM, e.endH, e.endM, e.pause)} Std. in „{(ROLES.find(r => r.key === e.role) || {}).label}"</div>}

            <div style={{ marginTop: 14, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
              <div className={'chip ' + (e.doubleShift ? 'on' : '')} style={{ marginBottom: e.doubleShift ? 12 : 0 }}
                onClick={() => upd('doubleShift', !e.doubleShift)}>
                ⚡ Doppelschicht
              </div>
            </div>

            {e.doubleShift && <>
              <div className="chips" style={{ marginTop: 8 }}>
                <div className={'chip rust ' + (e.s2ausfall ? 'on' : '')} onClick={() => upd('s2ausfall', !e.s2ausfall)}>
                  + Ausfallschicht (8h Sipo)
                </div>
              </div>
              {e.s2ausfall && <div className="calcnote" style={{ marginTop: 6 }}>+ 8h Ausfallschicht → Sipo · „Ausfallschicht" wird an die Baustelle angehängt</div>}
              {!e.s2ausfall && <>
                <div className="field" style={{ marginTop: 4 }}>
                  <label>Schicht 2 — Startzeit</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={e.s2startH || '22'} onChange={ev => upd('s2startH', ev.target.value)} style={{ flex: 1 }}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                    </select>
                    <span style={{ color: 'var(--ink-faint)', fontFamily: 'DM Mono,monospace' }}>:</span>
                    <select value={e.s2startM || '00'} onChange={ev => upd('s2startM', ev.target.value)} style={{ flex: 1 }}>
                      {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 11 }}>
                  <label>Schicht 2 — Endzeit</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={e.s2endH || '4'} onChange={ev => upd('s2endH', ev.target.value)} style={{ flex: 1 }}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                    </select>
                    <span style={{ color: 'var(--ink-faint)', fontFamily: 'DM Mono,monospace' }}>:</span>
                    <select value={e.s2endM || '30'} onChange={ev => upd('s2endM', ev.target.value)} style={{ flex: 1 }}>
                      {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 11 }}>
                  <label>Schicht 2 — Pause</label>
                  <div className="chips">
                    {[['0.5', '30 min'], ['0.75', '45 min'], ['1', '60 min']].map(([val, lbl]) => (
                      <div key={val} className={'chip ' + (e.s2pause === val ? 'on' : '')} onClick={() => upd('s2pause', val)}>{lbl}</div>
                    ))}
                  </div>
                </div>
                <div className="roleinfo" style={{ marginTop: 11 }}>Schicht 2 — Tätigkeit:</div>
                <div className="chips">
                  {ROLES.map(r => (
                    <div key={r.key} className={'chip ' + (e.s2role === r.key ? 'on' : '')} onClick={() => upd('s2role', r.key)}>{r.label}</div>
                  ))}
                </div>
                {shiftHours(e.s2startH, e.s2startM, e.s2endH, e.s2endM, e.s2pause) > 0 && <div className="calcnote">→ {shiftHours(e.s2startH, e.s2startM, e.s2endH, e.s2endM, e.s2pause)} Std. in „{(ROLES.find(r => r.key === e.s2role) || {}).label}"</div>}
              </>}
            </>}
          </>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label>Auch eintragen für</label>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {Array.from({ length: numDays }, (_, i) => i + 1).filter(d => d !== day).map(d => (
              <div key={d} className={'chip ' + (extraDays.includes(d) ? 'on' : '')} onClick={() => toggleDay(d)}
                style={{ minWidth: 40, textAlign: 'center', padding: '6px 8px' }}>
                <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 12 }}>{d}</span>
                <span style={{ fontSize: 10, color: extraDays.includes(d) ? 'inherit' : 'var(--ink-faint)', marginLeft: 3 }}>{weekdayFor(d)}</span>
              </div>
            ))}
          </div>
          {extraDays.length > 0 && <div className="calcnote">→ wird in {extraDays.length + 1} Tagen eingetragen</div>}
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={() => onSave(normalizeEntry(e), extraDays)}>{extraDays.length > 0 ? `${extraDays.length + 1} Tage speichern` : 'Speichern'}</button>
          {existing && <button className="btn btn-rust" onClick={onClear}>Löschen</button>}
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </>
  );
}

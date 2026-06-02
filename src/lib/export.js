import JSZip from 'jszip';
import { MONTHS, WEEKDAYS } from '../config/constants.js';
import { COLUMNS as C, SIPO_COL, roleCol, ROW_OFFSET } from '../config/excelColumns.js';
import { isHoliday, feiertagOverlap } from './holidays.js';
import {
  computeHours, shiftHours, nightHours, entryToTimeString, siteWithAusfall, isPureSpecial,
} from './hours.js';

// Pure transform: takes the sheet1.xml string + one month of data, returns patched XML.
// Kept browser-free so the column mapping (roles, Ausfall, Feiertag, night, Sunday) is testable.
export function patchSheetXml(xml, { name, pkw, month, year, numDays, entries, ausGuthaben, zuGuthaben }) {
  const aus = parseFloat(ausGuthaben) || 0;
  const zu = parseFloat(zuGuthaben) || 0;
  let total = 0;
  for (let d = 1; d <= numDays; d++) {
    if (entries[d]) total += computeHours(entries[d]);
  }
  total = Math.round(total * 100) / 100;
  const abrechnung = Math.round((total + aus - zu) * 100) / 100;

  function setStr(addr, val) {
    if (!val && val !== 0) return;
    const safe = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    xml = xml.replace(
      new RegExp(`(<c r="${addr}"[^>]*?)( t="[^"]*")?(>)(<v>[^<]*<\\/v>|<is>.*?<\\/is>)?(<\\/c>)`, 's'),
      (_, open) => {
        const cleanOpen = open.replace(/ t="[^"]*"/, '');
        return `${cleanOpen} t="inlineStr"><is><t>${safe}</t></is></c>`;
      }
    );
  }
  function setNum(addr, val) {
    if (val === '' || val == null || isNaN(val)) return;
    xml = xml.replace(
      new RegExp(`(<c r="${addr}"[^>]*?>)(<v>[^<]*<\\/v>|<is>.*?<\\/is>)?(<\\/c>)`, 's'),
      (_, open, _v, close) => `${open}<v>${val}</v>${close}`
    );
  }

  setStr(C.monthHeader, 'Stundenvorlage   Monat: ' + MONTHS[month]);
  setStr(C.name, name);

  for (let d = 1; d <= numDays; d++) {
    const r = d + ROW_OFFSET;
    const e = entries[d];
    if (!e) continue;
    const siteOut = siteWithAusfall(e) || e.site;
    if (siteOut) setStr(`${C.site}${r}`, siteOut);
    if (e.bst) setNum(`${C.bst}${r}`, Number(e.bst) || e.bst);
    const ts = entryToTimeString(e);
    if (ts) setStr(`${C.time}${r}`, ts);
    const pureSpecial = isPureSpecial(e);
    if (e.pause && !pureSpecial) setNum(`${C.pause}${r}`, parseFloat(e.pause));

    const hrs = computeHours(e);
    if (hrs) {
      const s1hrs = shiftHours(e.startH || 7, e.startM || 0, e.endH || 15, e.endM || 30, e.pause);

      if (e.special === 'urlaub') { setNum(`${C.urlaub}${r}`, hrs); }
      else if (e.special === 'krank') { setNum(`${C.krank}${r}`, hrs); }
      else if (e.special === 'schulung' || e.special === 'bahnarzt' || e.special === 'sfpa') { setNum(`${C.sfpa}${r}`, hrs); }
      else if (e.special === 'ausfall') { setNum(`${SIPO_COL}${r}`, 8); }
      else {
        const dayHol = isHoliday(year, month, d);
        const nextHol = isHoliday(year, month, d + 1);

        if (s1hrs > 0) {
          setNum(`${roleCol(e.role)}${r}`, s1hrs);
          if (dayHol || nextHol) {
            const rawDur = shiftHours(e.startH || 7, e.startM || 0, e.endH || 15, e.endM || 30, 0);
            const rawOverlap = feiertagOverlap(e.startH || 7, e.startM || 0, e.endH || 15, e.endM || 30, dayHol, nextHol);
            const fh1 = rawDur > 0 ? Math.round((s1hrs * rawOverlap / rawDur) * 100) / 100 : 0;
            if (fh1 > 0) setNum(`${C.feiertag}${r}`, fh1);
          }
        }

        if (e.doubleShift) {
          if (e.s2ausfall) {
            const base = roleCol(e.role) === SIPO_COL ? s1hrs : 0;
            setNum(`${SIPO_COL}${r}`, Math.round((base + 8) * 100) / 100);
          } else {
            const s2hrs = shiftHours(e.s2startH || 22, e.s2startM || 0, e.s2endH || 4, e.s2endM || 30, e.s2pause);
            if (s2hrs > 0) {
              const s2col = roleCol(e.s2role);
              if (s2col === roleCol(e.role)) setNum(`${s2col}${r}`, Math.round((s1hrs + s2hrs) * 100) / 100);
              else setNum(`${s2col}${r}`, s2hrs);
              if (dayHol || nextHol) {
                const s2RawDur = shiftHours(e.s2startH || 22, e.s2startM || 0, e.s2endH || 4, e.s2endM || 30, 0);
                const s2RawOverlap = feiertagOverlap(e.s2startH || 22, e.s2startM || 0, e.s2endH || 4, e.s2endM || 30, dayHol, nextHol);
                const fh2 = s2RawDur > 0 ? Math.round((s2hrs * s2RawOverlap / s2RawDur) * 100) / 100 : 0;
                if (fh2 > 0) {
                  const rawDur1 = shiftHours(e.startH || 7, e.startM || 0, e.endH || 15, e.endM || 30, 0);
                  const rawOvlp1 = feiertagOverlap(e.startH || 7, e.startM || 0, e.endH || 15, e.endM || 30, dayHol, nextHol);
                  const fh1 = rawDur1 > 0 ? Math.round((s1hrs * rawOvlp1 / rawDur1) * 100) / 100 : 0;
                  setNum(`${C.feiertag}${r}`, Math.round((fh1 + fh2) * 100) / 100);
                }
              }
            }
          }
        }
      }
    }
    if (e.auslose) setNum(`${C.auslose}${r}`, Number(e.auslose));

    const isSunday = new Date(year, month, d).getDay() === 0;
    if (isSunday && hrs && !pureSpecial) setNum(`${C.sunday}${r}`, hrs);

    if (!e.special && e.startH !== undefined) {
      let totalNight = nightHours(e.startH, e.startM, e.endH, e.endM);
      // Ausfall shift 2 has no real clock time, so it never contributes night hours.
      if (e.doubleShift && !e.s2ausfall) totalNight += nightHours(e.s2startH, e.s2startM, e.s2endH, e.s2endM);
      if (totalNight > 0) setNum(`${C.night}${r}`, totalNight);
    }
  }

  if (aus > 0) setNum(C.ausGuthaben, aus);
  if (zu > 0) setNum(C.zuGuthaben, zu);
  if (abrechnung) setNum(C.abrechnung, abrechnung);

  const today = new Date().toLocaleDateString('de-DE');
  setStr(C.date, `Datum:  ${today}`);
  setStr(C.signature, `Unterschrift MA.: ${(name || '').split(' ').pop()}`);
  if (pkw) setStr(C.pkw, pkw.toUpperCase());

  return xml;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function asciiSlug(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]+/g, '');
}

export function exportBasename(params) {
  const safeName = asciiSlug(params.name || 'Unbekannt') || 'Unbekannt';
  const mm = String(params.month + 1).padStart(2, '0');
  return `Auslose_${safeName}_${params.year}-${mm}`;
}

export function exportFilename(params) {
  return `${exportBasename(params)}.xlsx`;
}

export function exportCsvFilename(params) {
  return `${exportBasename(params)}.csv`;
}

/** Chromium only allows sharing certain types (csv, pdf, images…) — not .xlsx. */
export function canShareCsvFiles() {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probe = new File(['x'], 'probe.csv', { type: 'text/csv' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function downloadExportBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function saveExportBlob(blob, filename) {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Excel-Arbeitsmappe',
          accept: { [XLSX_MIME]: ['.xlsx'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }
  downloadExportBlob(blob, filename);
  return 'downloaded';
}

function csvCell(value) {
  const s = String(value ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildExportCsv(params) {
  const { year, month, numDays, entries, name, ausGuthaben, zuGuthaben } = params;
  const rows = [['Tag', 'Wochentag', 'Baustelle', 'Zeiten', 'Stunden'].map(csvCell).join(';')];
  let total = 0;
  for (let d = 1; d <= numDays; d++) {
    const e = entries[d];
    if (!e) continue;
    const wd = WEEKDAYS[new Date(year, month, d).getDay()];
    const site = siteWithAusfall(e) || e.site || '';
    const ts = entryToTimeString(e);
    const hrs = computeHours(e);
    total += hrs;
    rows.push([d, wd, site, ts, hrs].map(csvCell).join(';'));
  }
  total = Math.round(total * 100) / 100;
  const aus = parseFloat(ausGuthaben) || 0;
  const zu = parseFloat(zuGuthaben) || 0;
  const abrechnung = Math.round((total + aus - zu) * 100) / 100;
  rows.push('');
  rows.push(['', '', '', 'Gesamt', total].map(csvCell).join(';'));
  if (aus) rows.push(['', '', '', 'Aus Guthaben +', aus].map(csvCell).join(';'));
  if (zu) rows.push(['', '', '', 'Zu Guthaben −', zu].map(csvCell).join(';'));
  rows.push(['', '', '', 'Abrechnung', abrechnung].map(csvCell).join(';'));
  rows.unshift(csvCell(`${name || 'Stundenzettel'} — ${MONTHS[month]} ${year}`));
  const bom = '\ufeff';
  return new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

/** CSV is shareable in Chrome/Android; call from a tap handler. */
export async function shareCsvExport(params) {
  const blob = buildExportCsv(params);
  const filename = exportCsvFilename(params);
  const file = new File([blob], filename, { type: 'text/csv' });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    throw new Error('Teilen wird hier nicht unterstützt');
  }
  await navigator.share({ files: [file] });
}

// Builds the workbook blob from the template + month data.
export async function buildExportBlob(params) {
  const templateUrl = `${import.meta.env.BASE_URL}template.xlsx`;
  const resp = await fetch(templateUrl);
  if (!resp.ok) throw new Error('Vorlage nicht gefunden');
  const data = await resp.arrayBuffer();

  const zip = await JSZip.loadAsync(data);
  let xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  xml = patchSheetXml(xml, params);
  zip.file('xl/worksheets/sheet1.xml', xml);

  return zip.generateAsync({ type: 'blob', mimeType: XLSX_MIME });
}


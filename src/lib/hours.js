export function parseTimeRange(str) {
  // accepts "7.30 - 16.00", "19.00-7.00", "5.00 - 15.30"
  if (!str) return null;
  const m = str.replace(/\s/g, '').match(/(\d{1,2})[.:](\d{2})-(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  let [, h1, m1, h2, m2] = m;
  let start = (+h1) + (+m1) / 60;
  let end = (+h2) + (+m2) / 60;
  if (end <= start) end += 24; // overnight
  return end - start;
}

export function shiftHours(startH, startM, endH, endM, pause) {
  const start = (+startH) + (+startM || 0) / 60;
  let end = (+endH) + (+endM || 0) / 60;
  if (end <= start) end += 24;
  return Math.round(((end - start) - (parseFloat(pause) || 0)) * 100) / 100;
}

// Night-surcharge segments (23:00–06:00) of a shift, in shifted-clock hours
// (24–30 = next-day 00:00–06:00). Shared by the NA total and the editor preview.
export function nightSegments(startH, startM, endH, endM) {
  const start = (+startH) + (+startM || 0) / 60;
  let end = (+endH) + (+endM || 0) / 60;
  if (end <= start) end += 24;
  const segs = [];
  const mS = Math.max(start, 0), mE = Math.min(end, 6);   // early-morning [0, 6]
  if (mE > mS) segs.push({ start: mS, end: mE });
  const lS = Math.max(start, 22), lE = Math.min(end, 30); // late-night [22, 30]
  if (lE > lS) segs.push({ start: lS, end: lE });
  return segs;
}

// --- surcharge interval helpers (shifted clock: 24–30 = next-day 00:00–06:00) ---
const ovl = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Holiday sub-intervals of a shift [start,end], split at midnight.
function holoIntervals(start, end, dayHol, nextHol) {
  const iv = [];
  if (dayHol) iv.push([start, Math.min(end, 24)]);
  if (nextHol && end > 24) iv.push([24, end]);
  return iv;
}

// Sum of `segs` after removing the `excl` intervals and the break [bS,bE].
function netHours(segs, excl, bS, bE) {
  let total = 0;
  for (const [lo, hi] of segs) {
    let pieces = [[lo, hi]];
    for (const [eLo, eHi] of excl) {
      pieces = pieces.flatMap(([plo, phi]) =>
        (eHi <= plo || eLo >= phi) ? [[plo, phi]]
          : [...(eLo > plo ? [[plo, eLo]] : []), ...(eHi < phi ? [[eHi, phi]] : [])]);
    }
    for (const [plo, phi] of pieces) total += (phi - plo) - ovl(plo, phi, bS, bE);
  }
  return total > 0 ? Math.round(total * 100) / 100 : 0;
}

// Night hours in the 22:00–06:00 window, excluding holiday hours (a holiday overrides night)
// and the break. The break is taken 5h after shift start, so it only reduces the surcharge when
// it lands in the non-holiday night window.
export function nightHours(startH, startM, endH, endM, pause, dayHol = false, nextHol = false) {
  const start = (+startH) + (+startM || 0) / 60;
  let end = (+endH) + (+endM || 0) / 60; if (end <= start) end += 24;
  const segs = nightSegments(startH, startM, endH, endM).map(s => [s.start, s.end]);
  const p = parseFloat(pause) || 0;
  return netHours(segs, holoIntervals(start, end, dayHol, nextHol), start + 5, start + 5 + p);
}

// Sunday hours (calendar Sunday, split at midnight), excluding holiday hours (holiday wins) and
// the break. daySun / nextSun say whether day d and d+1 are Sundays.
export function sundayHours(startH, startM, endH, endM, pause, daySun, nextSun, dayHol = false, nextHol = false) {
  const start = (+startH) + (+startM || 0) / 60;
  let end = (+endH) + (+endM || 0) / 60; if (end <= start) end += 24;
  const segs = [];
  if (daySun) segs.push([start, Math.min(end, 24)]);
  if (nextSun && end > 24) segs.push([24, end]);
  const p = parseFloat(pause) || 0;
  return netHours(segs, holoIntervals(start, end, dayHol, nextHol), start + 5, start + 5 + p);
}

// Holiday hours worked on a public holiday, split at midnight, minus the break that falls in the
// holiday window. Holiday is top priority, so nothing is excluded.
export function feiertagHours(startH, startM, endH, endM, pause, dayHol, nextHol) {
  const start = (+startH) + (+startM || 0) / 60;
  let end = (+endH) + (+endM || 0) / 60; if (end <= start) end += 24;
  const p = parseFloat(pause) || 0;
  return netHours(holoIntervals(start, end, dayHol, nextHol), [], start + 5, start + 5 + p);
}

// Worked hours with the 8h daily minimum applied. Specials are already fixed at 8h.
export function dayHours(entry) {
  const h = computeHours(entry);
  return entry.special ? h : Math.max(8, h);
}

export const PURE_SPECIALS = ['urlaub', 'krank', 'schulung', 'bahnarzt', 'sfpa'];

export function isPureSpecial(entry) {
  return entry?.special && (PURE_SPECIALS.includes(entry.special) || entry.special === 'ausfall');
}

// Strip shift/double-shift fields so saved data matches a chip-only day (no phantom times).
export function specialEntry(special, site) {
  return { special, site, bst: '', auslose: '', manualHours: '8' };
}

export function normalizeEntry(e) {
  if (!e?.special) return e;
  const base = {
    special: e.special,
    site: e.site || '',
    bst: e.bst || '',
    auslose: e.auslose || '',
    manualHours: e.manualHours || '8',
  };
  if (e.special === 'ausfall') {
    return { ...base, site: e.site || 'Ausfallschicht', manualHours: '8' };
  }
  return base;
}

export function computeHours(entry) {
  if (PURE_SPECIALS.includes(entry.special)) {
    return parseFloat(entry.manualHours) || 0;
  }
  if (entry.special === 'ausfall') return 8;
  let total = 0;
  if (entry.startH !== undefined && entry.endH !== undefined) {
    total += shiftHours(entry.startH, entry.startM, entry.endH, entry.endM, entry.pause);
  } else {
    const range = parseTimeRange(entry.time);
    total += range ? (range - (parseFloat(entry.pause) || 0)) : 0;
  }
  if (entry.doubleShift) {
    if (entry.s2ausfall) total += 8;
    else if (entry.s2startH !== undefined) total += shiftHours(entry.s2startH, entry.s2startM, entry.s2endH, entry.s2endM, entry.s2pause);
  }
  return Math.round(total * 100) / 100;
}

export function blankEntry() {
  return {
    site: '', bst: '', startH: '7', startM: '00', endH: '15', endM: '30',
    pause: '0.5', role: 'sipo', special: '', manualHours: '', auslose: '',
    doubleShift: false, s2startH: '22', s2startM: '00', s2endH: '4', s2endM: '30',
    s2pause: '0.5', s2role: 'sipo',
  };
}

export function entryToTimeString(e) {
  if (isPureSpecial(e)) return '';
  if (!e.startH && !e.endH) return e.time || '';
  const sh = String(e.startH || '0').padStart(2, '0');
  const sm = String(e.startM || '00').padStart(2, '0');
  const eh = String(e.endH || '0').padStart(2, '0');
  const em = String(e.endM || '00').padStart(2, '0');
  let str = `${sh}.${sm} - ${eh}.${em}`;
  if (e.doubleShift && !e.s2ausfall) {
    const s2sh = String(e.s2startH || '0').padStart(2, '0');
    const s2sm = String(e.s2startM || '00').padStart(2, '0');
    const s2eh = String(e.s2endH || '0').padStart(2, '0');
    const s2em = String(e.s2endM || '00').padStart(2, '0');
    str += ` / ${s2sh}.${s2sm} - ${s2eh}.${s2em}`;
  } else if (e.doubleShift && e.s2ausfall) {
    str += ` / Ausfallschicht`;
  }
  return str;
}

export function daysInMonth(monthIdx, year) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

// F1b: append "Ausfallschicht" suffix to the site when a combined Ausfall shift is active.
export function siteWithAusfall(e) {
  const base = (e.site || '').trim();
  if (e.doubleShift && e.s2ausfall) {
    if (/ausfallschicht/i.test(base)) return base;
    return base ? `${base} Ausfallschicht` : 'Ausfallschicht';
  }
  return base;
}

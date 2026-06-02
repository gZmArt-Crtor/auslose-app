// Column map for the company .xlsx template (sheet1) — the single source of truth.
// When the template layout changes (H1), update ONLY this file.
//
// Data rows: calendar day d is written to row (d + ROW_OFFSET), i.e. day 1 -> row 6.
// Header labels (from the live template) for reference:
//   F Sipo/Arbeiter · G HFE/HBB/Erder · H Sakra/Bediener/Büp/SAS ·
//   I Sakra Personalunion/TH-Büp · J Azf/Sakra Technik · K S/F/P/A ·
//   L Urlaub · M Krank · N NA(night) · O SO(Sunday) · P F(Feiertag) · Q Auslöse

export const ROW_OFFSET = 5; // sheet row = day + ROW_OFFSET

export const COLUMNS = {
  // header / meta
  monthHeader: 'E1',
  name: 'C1',
  // per-day fields
  site: 'B',
  bst: 'C',
  time: 'D',
  pause: 'E',
  // worked-hours role columns (keyed by ROLES[].key in constants.js)
  roles: { sipo: 'F', hfe: 'G', sakra: 'H', sakrapu: 'I', azf: 'J' },
  // specials
  sfpa: 'K', // S/F/P/A (Feiertag / Schulung / Bahnarzt)
  urlaub: 'L',
  krank: 'M',
  // surcharges / extras
  night: 'N',
  sunday: 'O',
  feiertag: 'P',
  auslose: 'Q',
  // summary block
  zuGuthaben: 'F38',
  ausGuthaben: 'F39',
  abrechnung: 'F40',
  // signature row
  date: 'B44',
  signature: 'D44',
  pkw: 'L44',
};

export const SIPO_COL = COLUMNS.roles.sipo;

// Column letter for a role key, falling back to Sipo.
export function roleCol(key) {
  return COLUMNS.roles[key] || SIPO_COL;
}

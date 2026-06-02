export const STORAGE_KEY = 'auslose_v2';
export const LEGACY_KEY = 'auslose_v1';
export const SCHEMA_VERSION = 2;

export function monthKey(year, monthIdx) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
}

export function blankMonth() {
  return { entries: {}, ausGuthaben: '', zuGuthaben: '' };
}

function freshState() {
  const now = new Date();
  return {
    version: SCHEMA_VERSION,
    name: '',
    pkw: '',
    month: now.getMonth(),
    year: now.getFullYear(),
    months: {},
  };
}

// Merge entries into a month bucket, filling empty days only (B2). Mutates/returns bucket.
function mergeEntriesFillEmpty(bucket, entries) {
  for (const [day, entry] of Object.entries(entries || {})) {
    if (bucket.entries[day] === undefined) bucket.entries[day] = entry;
  }
  return bucket;
}

// One-time migration from the flat v1 schema to v2 month-scoped storage.
// B1: place old flat `entries` into the month/year saved in the v1 record.
// B2: only fill days that don't already exist (never overwrite).
function migrateFromV1() {
  let raw;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let v1;
  try {
    v1 = JSON.parse(raw);
  } catch {
    return null;
  }

  const state = freshState();
  state.name = v1.name || '';
  state.pkw = v1.pkw || '';

  const now = new Date();
  const targetMonth = Number.isInteger(v1.month) ? v1.month : now.getMonth();
  const targetYear = Number.isInteger(v1.year) ? v1.year : now.getFullYear();

  if (v1.entries && Object.keys(v1.entries).length > 0) {
    const key = monthKey(targetYear, targetMonth);
    const bucket = blankMonth();
    bucket.ausGuthaben = v1.ausGuthaben || '';
    bucket.zuGuthaben = v1.zuGuthaben || '';
    mergeEntriesFillEmpty(bucket, v1.entries);
    state.months[key] = bucket;
    state.month = targetMonth;
    state.year = targetYear;
  }

  return state;
}

export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch {
      /* fall through to migration / fresh */
    }
  }

  const migrated = migrateFromV1();
  if (migrated) {
    saveState(migrated);
    return migrated;
  }

  return freshState();
}

export function normalizeState(parsed) {
  const base = freshState();
  return {
    ...base,
    ...parsed,
    version: SCHEMA_VERSION,
    months: parsed && parsed.months ? parsed.months : {},
  };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable - ignore */
  }
}

export function getMonth(state, year, monthIdx) {
  return state.months[monthKey(year, monthIdx)] || blankMonth();
}

// ── Backup / restore (full state) ──
export function serializeBackup(state) {
  return JSON.stringify(state, null, 2);
}

export function backupFilename(date = new Date()) {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `Ausloese_Backup_${d}.json`;
}

// Validate + normalize an imported backup. Throws on invalid input. (G2: replace)
export function parseBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.months !== 'object') {
    throw new Error('Ungültige Sicherungsdatei.');
  }
  return normalizeState(parsed);
}

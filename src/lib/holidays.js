// Bavaria public holidays Algorithm Gauss(auto-detect)
export function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function holidaySet(year) {
  const e = easterDate(year);
  const off = (o) => {
    const x = new Date(e);
    x.setDate(e.getDate() + o);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  return new Set([
    `${year}-01-01`, `${year}-01-06`, off(-2), off(1), `${year}-05-01`,
    off(39), off(50), off(60), `${year}-08-15`, `${year}-10-03`,
    `${year}-11-01`, `${year}-12-25`, `${year}-12-26`,
  ]);
}

export function isHoliday(year, monthIdx, day) {
  const d = new Date(year, monthIdx, day);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return holidaySet(d.getFullYear()).has(key);
}

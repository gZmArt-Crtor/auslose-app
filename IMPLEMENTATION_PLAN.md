# Auslöse Stundenzettel — Implementation Plan

**Status:** Milestone 1 implemented (Vite + month-scoped storage + migration). Bonus: most of Milestone 2 (backup/restore, version constant, export name guard) and Milestone 4's in-app confirm dialogs also done.

**Progress log:**
- ✅ M1 — Vite + React scaffold, code split into `src/`, `auslose_v2` month-scoped storage, v1→v2 migration (B1 saved month, B2 fill-empty-only), `lastMonth`/`lastYear` remembered, totals/Monat leeren/export scoped to active month, PWA service worker via `vite-plugin-pwa`, `base: '/auslose-app/'`, build verified, 13/13 storage tests passed, preview serves 200.
- ✅ M2 (partial) — Daten sichern / Wiederherstellen (full backup, replace), `APP_VERSION` constant, export warning when name empty.
- ✅ M3 — F1b site suffix shown on day cards + Excel col B; editor help text (standalone Ausfall vs Doppelschicht+Ausfall); holiday markers + editor hint; removed dead code (`startWorked` gone, unused `SPECIAL` removed); refactored `export.js` into testable `patchSheetXml`; 12/12 export-mapping tests pass. Bug fix: `s2ausfall` no longer adds phantom night hours from leftover shift-2 default times.
- ✅ M4 — template externalized to `public/template.xlsx` (fetched at export; base64 + `template.js` removed → JS bundle ~284 kB); `src/config/excelColumns.js` column-map config added; in-app `ConfirmDialog` for Monat leeren / import; icons in `public/`; README rewritten; GitHub Pages workflow `.github/workflows/deploy.yml`. Removed superseded root `sw.js` / `manifest.json` (legacy archived as `*.legacy.*`).
- ⏳ Remaining (M5 / later): real Dispo OCR-AI, month progress indicator, accessibility (zoom/focus trap/Escape), import merge mode. Open item: wire `export.js` fully to `excelColumns.js` once the complete/updated column list (H3) is provided.


**Version target:** v2.0.0 (schema + Vite migration)

**Audience:** Private/colleague use on personal phones · deploy via **GitHub Pages**

---

## 1. Product summary

A **Progressive Web App** for monthly shift logging and **Excel export** (company timesheet template). Data stays **local** (`localStorage`). Features include per-day entries, role columns, Auslöse, Doppelschicht, Bavarian holidays, night/Sunday/holiday surcharges, optional Dispo scan (OCR/AI later), JSON backup/restore.

---

## 2. Locked design decisions

### 2.1 Storage (A1, A2, C1, C2)

| Decision | Choice |
|----------|--------|
| Structure | **One** `localStorage` key: `auslose_v2` |
| Month data | Nested `months["YYYY-MM"]` (e.g. `"2026-05"`) |
| Per month | `{ entries, ausGuthaben, zuGuthaben }` |
| Global fields | `name`, `pkw`, `lastMonth`, `lastYear`, `version` |
| Name / PKW | **Global** (one user per device) |
| On app open | **Remember** `lastMonth` / `lastYear` (no forced jump to “today”) |
| Persistence | **Autosave** on every state change (immediate) |

**Schema sketch:**

```json
{
  "version": 2,
  "name": "Max Mustermann",
  "pkw": "HO-AB 123",
  "lastMonth": 4,
  "lastYear": 2026,
  "months": {
    "2026-05": {
      "entries": { "15": { "site": "München", "role": "hfe", "..." } },
      "ausGuthaben": "",
      "zuGuthaben": ""
    }
  }
}
```

**Helpers:**

- `monthKey(year, monthIdx) => `${year}-${String(monthIdx + 1).padStart(2, '0')}``
- `getActiveMonth(state)` → `state.months[key] ?? { entries: {}, ausGuthaben: '', zuGuthaben: '' }`
- On **month/year** change: read/write via active key only

---

### 2.2 Migration v1 → v2 (B1, B2)

**When:** First launch after update, if `auslose_v1` exists and `auslose_v2` does not.

| Rule | Choice |
|------|--------|
| **B1** — target month for old flat `entries` | Month/year **stored in the v1 JSON** (`parsed.month`, `parsed.year`) |
| **B2** — conflicts | **Fill empty only**: migrate day `d` only if `months[key].entries[d]` is missing |
| Preserve | Global `name`, `pkw` from v1 |
| After success | Set `lastMonth` / `lastYear` from migrated target; optionally keep `auslose_v1` read-only backup or remove after successful write |
| UI | Optional one-time toast: “Daten nach Mai 2026 übernommen” |

**Do not** assign v1 entries to “current calendar month” unless v1 had no month/year saved.

---

### 2.3 Monat leeren (D1, D2)

| Clears | Does **not** clear |
|--------|---------------------|
| Active month `entries` | `name`, `pkw` |
| Active month `ausGuthaben`, `zuGuthaben` | Other months in `months` |

**Confirmation:** **Light** — single confirm; implement as **in-app dialog** (Milestone 4), interim `confirm()` acceptable in M1.

---

### 2.4 Multi-day copy (E1, E2)

| Rule | Choice |
|------|--------|
| “Auch eintragen für” | Copy **everything** (full entry object) |
| After save | **Deep clone** per day — days are independent |

---

### 2.5 Ausfall + work same day (F1)

**Not** the standalone **Ausfallschicht** chip (whole day = 8h Sipo only).

**Combo day workflow** (Ausfall first, then Dispo sends another shift):

1. Enter **Schicht 1**: Baustelle, times, pause, role (e.g. HFE → column G).
2. Enable **Doppelschicht**.
3. Enable **+ Ausfallschicht (8h Sipo)** (`s2ausfall` on Schicht 2).
4. **F1a:** UI order of Schicht 1 vs 2 does not matter; export maps work → role column, Ausfall → **F** (8h).
5. **F1b — Baustelle label:** On save, if `s2ausfall`:  
   `siteDisplay = trim(site) + (site already ends with "Ausfallschicht" ? "" : " Ausfallschicht")`  
   Use for **on-screen display** and Excel **column B**.

**Standalone Ausfallschicht chip:** Unchanged — full day special, 8h Sipo, site “Ausfallschicht”.

**Cleanup:** Remove unused `startWorked` path in `computeHours` unless a separate requirement appears.

---

### 2.6 Feiertag (F2)

| Feature | Plan |
|---------|------|
| Calendar | Mark Bavarian public holidays (`holidaySet` / `isHoliday` — existing) |
| Day editor | Banner/hint on holiday: suggest **Feiertag** chip or S/F/P/A |
| Worked on holiday | Keep live **Feiertagszuschlag** + export column **P** (existing logic) |
| Manual | User can still set **Feiertag** chip for full 8h in **K** without work |

---

### 2.7 Backup / import (G1, G2, G3)

| Item | Choice |
|------|--------|
| **G1** | Export **full** app state: all `months` + global `name`, `pkw`, `lastMonth`, `lastYear`, `version` |
| **G2** | Import = **Replace** entire local `auslose_v2` after explicit confirm |
| **G3** | Download name: `Ausloese_Backup_YYYY-MM-DD.json` |
| UI labels | “Daten sichern” / “Daten wiederherstellen” |

**Import confirm copy (draft):**  
“Alle Daten auf diesem Gerät werden durch die Sicherung ersetzt. Fortfahren?”

---

### 2.8 Excel / template (H1, H2, H3)

| Item | Choice |
|------|--------|
| **H1** | Template may change occasionally |
| **H2** | Move embedded base64 → `public/template.xlsx`; fetch at export time |
| **H3** | Column map as config (e.g. `src/config/excelColumns.js`) when product owner provides full column list |
| Export engine | Keep JSZip + XML cell patching until/unless SheetJS rewrite is justified |

**Existing column map (reference):**

| Data | Column |
|------|--------|
| Name | C1 |
| Month header | E1 |
| Site | B |
| Bst | C |
| Time string | D |
| Pause | E |
| Sipo / roles | F–J |
| S/F/P/A, Urlaub, Krank | K, L, M |
| Night | N |
| Sunday | O |
| Feiertag portion | P |
| Auslöse | Q |
| zu Guthaben | F38 |
| aus Guthaben | F39 |
| Abrechnung | F40 |
| Signature row | B44, D44, L44 |

---

### 2.9 Platform & stack (I, I3, I4, J)

| Item | Choice |
|------|--------|
| Users | Colleagues (each own phone, own data) |
| Hosting | **GitHub Pages** |
| Build | **Vite** + React |
| OCR / Dispo | Keep UI; Tesseract placeholder until dispatch layout is standardized; then AI/recognizer behind same button |
| Polish order | (1) In-app confirms (2) other UX (3) README + PWA icons |

---

## 3. Milestones

### Milestone 1 — Vite + month-scoped storage

**Goal:** Same UX, correct data per month; deployable `dist/`.

| # | Task |
|---|------|
| 1.1 | Create Vite + React project under `auslose-app/` (preserve branding/styles) |
| 1.2 | Split: `App`, `DayEditor`, `storage.js`, `hours.js`, `holidays.js`, `export.js`, CSS |
| 1.3 | Implement `auslose_v2` schema + `loadState` / `saveState` |
| 1.4 | Wire UI to active month bucket; month/year selectors load/save correct bucket |
| 1.5 | Implement v1 → v2 migration (B1, B2) |
| 1.6 | Remove “force current month on load”; use `lastMonth` / `lastYear` |
| 1.7 | Fix totals, Monat leeren, export to use **active month only** |
| 1.8 | `vite.config.js`: `base` for GitHub Pages (repo name if project site) |
| 1.9 | Service worker: cache `dist` assets; version tied to `APP_VERSION` |
| 1.10 | Smoke test: two months, switch, no bleed; export one month |

**Exit criteria:** No cross-month entry bleed; migration from v1 works once.

---

### Milestone 2 — Backup, import, version

| # | Task |
|---|------|
| 2.1 | “Daten sichern” → JSON download (full state, G3 filename) |
| 2.2 | “Daten wiederherstellen” → file picker → validate `version` → replace state (G2) |
| 2.3 | Central `APP_VERSION` in `src/version.js` (+ display in header; sync SW cache name) |
| 2.4 | Pre-export warning if `name` is empty |

**Exit criteria:** Backup on phone A → import on phone B restores all months.

---

### Milestone 3 — F1 UX + F2 holidays + cleanup

| # | Task |
|---|------|
| 3.1 | On save with `s2ausfall`, apply F1b site suffix |
| 3.2 | Short help in day editor: standalone Ausfall chip vs Doppelschicht + Ausfall |
| 3.3 | Holiday markers on day cards; hint in `DayEditor` on holiday dates |
| 3.4 | Remove dead code: `startWorked`, unused `SPECIAL` if unused, drop `xlsx` CDN if not used |
| 3.5 | Verify export: HFE in G + 8h in F when `s2ausfall` + role hfe |

**Exit criteria:** Combo day matches payroll example; holidays visible.

---

### Milestone 4 — External template + confirms + docs

| # | Task |
|---|------|
| 4.1 | Extract template to `public/template.xlsx`; remove base64 from source |
| 4.2 | `excelColumns.js` config stub; extend when H3 column list arrives |
| 4.3 | In-app `ConfirmDialog` for Monat leeren, import replace |
| 4.4 | Complete `README.md`: install, dev, build, GitHub Pages, backup, migration |
| 4.5 | Ensure `icon-192.png`, `icon-512.png` in repo; manifest paths correct |

**Exit criteria:** Template updatable without editing JS body; colleagues can deploy from README.

---

### Milestone 5 — Later (scoped per owner decision 2026-06-02)

- ⏩ **Dispo OCR / AI recognizer** — **LAST step**, only after the company standardizes the dispatch format. Lowest priority.
- ❌ **Month progress indicator** — dropped (not needed).
- ❌ **Accessibility** (zoom, focus trap, Escape) — dropped; app is phone-only. May be added manually later.
- ❌ **Import merge mode** — dropped; Replace-only is sufficient for the one-device/phone workflow.
- ◽ Optional export smoke test (Node script) — nice-to-have.

**Open dependencies (from owner, non-blocking):**
1. Full/updated Excel **column list (H3)** → then move all column letters in `export.js` into `src/config/excelColumns.js`.
2. Enable GitHub Pages: repo **Settings → Pages → Source: GitHub Actions** (only the owner can toggle this).

---

## 4. Project structure (target)

```text
auslose-app/
├── public/
│   ├── template.xlsx          # Milestone 4
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── DayEditor.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── ...
│   ├── lib/
│   │   ├── storage.js         # v2, migration, backup
│   │   ├── hours.js
│   │   ├── holidays.js
│   │   └── export.js
│   ├── config/
│   │   └── excelColumns.js
│   ├── version.js
│   └── index.css
├── sw.js                      # or vite-plugin-pwa
├── index.html
├── vite.config.js
├── package.json
├── README.md
└── IMPLEMENTATION_PLAN.md     # this file
```

**Legacy:** Current monolithic `index.html` remains until M1 cutover; archive or replace after `dist/` verified.

---

## 5. GitHub Pages deployment

1. `npm run build` → `dist/`
2. GitHub repo → Settings → Pages → source: **GitHub Actions** or branch `gh-pages` / `/docs` with `dist` contents
3. Vite `base: '/<repo-name>/'` for project sites (e.g. `https://user.github.io/auslose-app/`)
4. Service worker scope must match `base`

---

## 6. Testing checklist (manual)

- [ ] Fresh install: empty state, add May, add June, switch — no shared days
- [ ] v1 fixture: entries land in saved month; empty-only merge
- [ ] Monat leeren: only active month cleared
- [ ] Multi-day copy: edit one day, others unchanged
- [ ] F1: München + work + Doppelschicht + s2ausfall → site + export B + F/G
- [ ] Feiertag: calendar hint; export P on worked holiday
- [ ] Backup → clear storage → import → all months back
- [ ] Export with empty name → warning
- [ ] Offline: open installed PWA after one visit
- [ ] GitHub Pages: assets and SW load under subpath

---

## 7. Open items (product owner)

- [ ] Full Excel column list for H3 / `excelColumns.js`
- [ ] Confirm GitHub repo name for Vite `base`
- [ ] Exact Feiertag chip behavior on auto-detect (suggest only vs auto-fill 8h)

## 7.5: Bugs found while testing after M1:

When selecting doppelschicht and ausfallschicht the app still inputs the time worked as if nightshift and puts the zuschläge into the columns because the app still sends the work time even when ausfallschicht is selected. I fixed a similar issue when i was working on one of the normal cards without doppelschicht.


---

## 8. Go / no-go

| Command | Action |
|---------|--------|
| **“Start Milestone 1”** (or “go”) | Begin Vite scaffold + storage migration |
| Changes to this doc | Update before coding conflicting behavior |

---

*Last updated: 2026-06-02 — reflects conversation spec through F1b, B1, B2, G1, G2, Vite, GitHub Pages.*

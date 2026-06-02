# Auslöse Stundenzettel (PWA)

A private, installable web app for filling in your monthly work-hour sheet
("Stundenzettel") and exporting it to the company Excel template — including
*Auslöse* (expense allowance), night/Sunday/holiday surcharges, double shifts
and Bavarian public-holiday detection.

All data stays **on your device** (`localStorage`). No server, no account.

---

## Tech stack

- **Vite + React 18** (build step, split into modules under `src/`)
- **vite-plugin-pwa** (offline service worker + installable manifest)
- **JSZip** for patching the `.xlsx` template at export time
- **tesseract.js** (optional Dispo-screenshot OCR — placeholder for future AI)

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/auslose-app/
```

## Build & preview

```bash
npm run build    # outputs to dist/
npm run preview  # serves the production build locally
```

## Deploy (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to GitHub Pages.

One-time setup: GitHub repo → **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

The site is served from a subpath, so `vite.config.js` sets:

```js
base: '/auslose-app/'
```

If you rename the repository, update `base` to match.

---

## Data model & storage

Stored under the `auslose_v2` key:

```jsonc
{
  "version": 2,
  "name": "…",            // global (one user per device)
  "pkw": "…",             // global
  "month": 4, "year": 2026, // last viewed month (remembered)
  "months": {
    "2026-05": { "entries": { "15": { /* … */ } }, "ausGuthaben": "", "zuGuthaben": "" }
  }
}
```

- Each calendar month is its own bucket (`"YYYY-MM"`); switching month never
  mixes data.
- **Migration**: on first launch the old flat `auslose_v1` data is moved into the
  month/year saved in that record, filling only empty days (never overwriting).

### Backup / restore

- **Daten sichern** downloads the full state as `Ausloese_Backup_YYYY-MM-DD.json`.
- **Wiederherstellen** replaces all local data from a backup file (after confirm).

---

## Excel export

`src/lib/export.js` fetches `public/template.xlsx`, patches the cells of
`sheet1.xml` and triggers a download. The cell map is documented in
`src/config/excelColumns.js`.

Day `d` is written to row `d + 5` (day 1 → row 6). Key columns:

| Data | Column |
|------|--------|
| Site / Bst / time / pause | B / C / D / E |
| Roles (Sipo…Azf) | F–J |
| S/F/P/A · Urlaub · Krank | K · L · M |
| Night · Sunday · Feiertag · Auslöse | N · O · P · Q |
| zu/aus Guthaben · Abrechnung | F38 / F39 / F40 |

### Updating the template

The template may change occasionally. To update it: replace
`public/template.xlsx` with the new file and, if columns moved, update
`src/config/excelColumns.js` (and the inline addresses in `export.js`).

---

## Special-day rules

- **Ausfallschicht** (standalone): whole day = 8h Sipo (col F).
- **Ausfall + real shift same day**: enter the normal shift, enable
  **⚡ Doppelschicht**, then **+ Ausfallschicht (8h Sipo)**. Worked hours go to the
  role column, +8h to Sipo (F), and the site is suffixed with `Ausfallschicht`.
- **Feiertag**: Bavarian holidays are auto-detected and marked; worked holiday
  hours add a surcharge portion to column P.

---

## Project structure

```text
src/
├── main.jsx
├── App.jsx                 # month-scoped state, totals, backup, export
├── version.js              # APP_VERSION
├── index.css
├── config/
│   ├── constants.js        # WEEKDAYS, MONTHS, ROLES
│   └── excelColumns.js     # template column map
├── lib/
│   ├── holidays.js         # Bavaria holiday detection
│   ├── hours.js            # shift/night/feiertag math
│   ├── storage.js          # auslose_v2 + migration + backup
│   └── export.js           # patchSheetXml (pure) + exportXlsx (download)
└── components/
    ├── DayEditor.jsx
    └── ConfirmDialog.jsx
public/
├── template.xlsx
├── icon-192.png
└── icon-512.png
```

Legacy single-file version is archived as `index.legacy.html` / `sw.legacy.js`.

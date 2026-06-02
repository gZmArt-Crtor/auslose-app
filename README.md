# Auslöse Stundenzettel (PWA)

A private, installable web app for filling in your monthly work-hour / Auslöse sheet and exporting it to the same `.xlsx` layout you already use. Runs entirely on your phone — **no server, no account, no cost.** All data is stored locally in your browser.

## What it does

- One tappable card per day of the month (weekends and Feiertage are visually marked)
- Tap a day → enter Baustelle, Bst.-Nr., Arbeitszeit (von-bis), Pause, role (Sipo / HFE / Sakra / …), Auslöse, km
- **Work hours are calculated automatically** from the time range minus pause — including overnight shifts (e.g. `19.00 - 7.00`)
- One-tap **Feiertag** (8 in S/F/P/A), Urlaub, Krank
- **Gesamtstunden** total updates live; enter *Stunden zur Abrechnung* and *zu Guthaben* is computed for you
- **Optional screenshot scan (OCR):** tap "Dispo-Screenshot scannen" to pre-fill date/time/Bst from a photo using on-device OCR (Tesseract.js). It's a helper — always check the fields, it can't know everything.
- **Excel export** produces `Auslöse_Art_<Monat>.xlsx`
- Everything saved between sessions; works offline once installed

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app |
| `manifest.json` | Makes it installable |
| `sw.js` | Offline support (service worker) |
| `icon-192.png`, `icon-512.png` | App icons |

## Putting it on GitHub (private) + hosting it

A PWA must be served over **https** to be installable. GitHub Pages does this for free. Note: with a *free* GitHub account, Pages on a private repo isn't published — so either (a) make the repo public (the app holds no secrets), or (b) keep the repo private and use any static host. Public repo is simplest; your *data* never leaves your phone regardless.

### Option A — git command line
```bash
cd auslose-app
git init
git add .
git commit -m "Auslöse Stundenzettel PWA"
git branch -M main
# create an empty repo named 'auslose-app' on github.com first, then:
git remote add origin https://github.com/<YOUR-USERNAME>/auslose-app.git
git push -u origin main
```
Then on GitHub: **Settings → Pages → Source: `main` / root → Save.**
Your app appears at `https://<YOUR-USERNAME>.github.io/auslose-app/` within a minute or two.

### Option B — web upload (no command line)
1. On github.com, click **New repository**, name it `auslose-app`, create it.
2. Click **uploading an existing file**, drag in all 5 files, commit.
3. **Settings → Pages → Source: `main` / root → Save.**

## Installing on your Android phone

1. Open the Pages URL in **Chrome** on your phone.
2. Tap the **⋮ menu → "Add to Home screen"** (or "Install app").
3. It now has its own icon and opens full-screen like a normal app, fully offline.

## Want a real .apk later?

Once it's hosted, go to **https://www.pwabuilder.com**, paste your Pages URL, and it will package a signed Android `.apk`/`.aab` you can sideload. No code changes needed.

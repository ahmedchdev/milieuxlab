# MilieuXlab — Project Context

> Living document. Updated automatically each turn in this session. Captures project map, decisions, current state, and session log.

---

## 1. Project Map

### Identity
- **App name:** MilieuXlab
- **Domain:** Culture Media Manager / Microbiology Analyst Tool
- **Type:** Mobile web app (responsive, French UI)
- **Source spec:** `script-milieuxlab.md` (v2.0)
- **Working dir:** `C:\Users\ahmed\Desktop\MilieuXlab\`
- **Storage:** localStorage only — no backend, no internet required

### Core Business Logic

**Shelf life**
- Solid (agar) = 30 days
- Broth = 15 days

**Sterility duration formats** (3 supported per medium)
- Fixed (days) — single value
- Fixed (hours) — single value
- Range (hours) — min + max; **only max date is displayed**

**Date formulas**
- Fertility result = prep + fertility delay (days per strain)
- Sterility result = prep + sterility duration (max if range)
- Expiry = prep + shelf life
- **Renewal alert = expiry − fertility delay − 2 days buffer**

**Buffer margin:** fixed at 2 days (safety against delays)

### Pre-configured Media (8 defaults)
| Medium | Type | Strain | Fertility | Sterility |
|---|---|---|---|---|
| TSA | Solid | S. aureus ATCC 6538 | 5d | 5d (fixed) |
| MacConkey Agar | Solid | E. coli ATCC 8739 | 2d | 18–72h (range) |
| Sabouraud | Solid | C. albicans ATCC 10231 | 5d | 5d (fixed) |
| Mueller-Hinton | Solid | S. aureus ATCC 25923 | 3d | 5d (fixed) |
| TSB | Broth | S. aureus ATCC 6538 | 5d | 14d (fixed) |
| BHI | Broth | S. aureus ATCC 6538 | 5d | 14d (fixed) |
| XLD Agar | Solid | Salmonella typhimurium | 2d | 18–24h (range) |
| Phosphate Buffer Solution | Broth | E. coli ATCC 8739 | 2d | 18–24h (range) |

### App Structure — 4 Tabs
1. **Dashboard** — alert banner, 4 stat tiles, batch cards with progress bar + color-coded left stripe
2. **Register** — new batch form with live-calculated dates preview
3. **Media** — list/add/edit/delete media (defaults protected from delete)
4. **Settings** — notifications toggle, show-expired toggle, reset, active rules summary

### Design System

**Colors**
- Background: `#0A0E14` (dark navy)
- Card: `#111820`
- Primary accent (solid/OK): `#00C896` (green)
- Secondary accent (broth/sterility): `#0084FF` (blue)
- Warning: `#FFB020` (amber) — expiry < 7d
- Danger: `#FF4560` (red) — renewal overdue
- Primary text: `#E8F0F8`
- Muted text: `#5A7A99`

**Typography**
- Titles/buttons: **Syne** (Bold 700/800)
- Dates/codes/data: **DM Mono** (Regular 400)
- Technical labels: **DM Mono** uppercase + letter-spacing

**Card left-border status colors**
- Green: in progress, no issue
- Orange: expiry within 7 days
- Red: renewal alert passed
- Grey (dimmed): expired (only if setting enabled)

### Alert Triggers
- 🔴 Renewal date reached → "Prepare a new batch"
- 🟡 Fertility result due today
- 🟡 Sterility result due today
- 🔴 Expiry date reached → "BATCH EXPIRES TODAY"

Channels: visual banner on dashboard + browser push (if permission granted).

### Data Model (inferred)
- **Media** { id, name, type, shelfLifeDays, strain, fertilityDelayDays, sterilityFormat, sterilityValue, sterilityMinHours, sterilityMaxHours, isDefault }
- **Batch** { id, mediumId, lotNumber, prepDate, prepTime, fertilityResultDate, sterilityResultDate, expiryDate, renewalAlertDate }
- **Settings** { browserNotifications, showExpired }

### Media Management Rules
- View: all users see default + custom
- Add custom: user, saved permanently
- Edit any: user (defaults editable)
- Delete custom: user, with confirm
- Delete default: **not allowed** (protected)

---

## 2. Current State

- **Repo state:** Built. 4 files in `C:\Users\ahmed\Desktop\MilieuXlab\`
  - `index.html` — 4-tab shell + modal/toast
  - `styles.css` — mobile-first dark theme, full design system
  - `app.js` — state, calculations, rendering, localStorage, notifications
  - `script-milieuxlab.md` — original spec
  - `CLAUDE.md` — this file
- **Stack:** vanilla HTML/CSS/JS, no build step, no framework
- **Run:** open `index.html` directly, or `python -m http.server` / `node` static server
- **Session date:** 2026-06-12

### Implementation Notes
- Default media list hardcoded in `app.js` (`DEFAULT_MEDIA`); defaults have `isDefault: true` and are protected from delete
- Batches and custom media persist in `localStorage` (keys: `milieuxlab.batches.v1`, `milieuxlab.media.v1`, `milieuxlab.settings.v1`)
- Date math: `computeBatchDates(medium, prep)` returns fertility/sterility/expiry/renewal; buffer = 2 days
- Sterility duration: `days` | `hours` | `range (min/max hours)`; range uses **max** for display
- Browser notifications only fire on app load (one-time); permission requested when toggle is enabled
- Status colors: green (ok), amber (≤7d to expiry), red (renewal passed, with pulsing animation), grey (expired, dimmed)
- **PDF export** of the renewal schedule via a vendored vanilla-JS PDF generator (`pdf.js`, ~14KB, zero dependencies, fully offline). Triggered by the « ⤓ PDF » button in the dashboard header → filter modal (period + urgent-only) → builds a real `application/pdf` Blob and triggers `<a download>` of `planning-renouvellement-YYYY-MM-DD.pdf`. No print dialog, no Chrome `file://` footer. API: `new PDF()`, `.text()`, `.rect()`, `.line()`, `.addPage()`, `.table()` (with auto-pagination + header repeat + cell truncation), `.footer()` (post-stamped on every page at download time with correct total count), `.download()`. PDF 1.4, 4 built-in Helvetica variants with WinAnsiEncoding (handles é/à/ç/·/—/… natively). `buildPdfDoc` reuses `batchStatus` for status and `daysBetween`/`fmtDate` for formatting

---

## 3. Open Questions / Decisions Needed

- None — initial build shipped with vanilla stack per user direction.

---

## 4. Session Log

### 2026-06-12 — Session 1
- User introduced project MilieuXlab and asked to read `script-milieuxlab.md`
- Read full spec (365 lines): culture media tracker for microbiology analysts
- Created this `CLAUDE.md` to persist project context across the session
- User said: build it fresh, mobile-first, responsive, clean & attractive UI
- **Built:** `index.html` (4 tabs), `styles.css` (dark theme, full design system), `app.js` (state, calc, render, localStorage, notifications)
- **Verified:** files serve 200 on Node static server, `app.js` passes `node --check`, all `getElementById` refs match HTML IDs
- **Next:** test on a mobile device or in browser DevTools mobile mode, then iterate on visual polish / new features

### 2026-06-13 — Session 2 — PDF Export (initial)
- User asked for: auto-generated PDF of the renewal schedule — title, generation date, recap table (medium, lot, prep/expiry/renewal dates, days remaining, status), sorted by renewal date ascending, with expired/urgent rows highlighted; A4 portrait, lab header, paginated footer, filters (period + « only renewal soon »), summary counts at top
- Chose `window.print()` + `@media print` over jsPDF to keep the app fully offline (no CDN); user agreed
- Lab name: persisted in Réglages (new `labName` field on `state.settings`); falls back to « MilieuXlab » if empty
- Group-by week/month: deferred to v2 at user's request
- **Built:** « ⤓ PDF » button in dashboard section-head, `#pdf-filters` modal (period select + « uniquement à renouveler » checkbox), hidden `#print-area` div, `s-labname` input in Réglages, new PDF EXPORT section in `app.js` (openPdfFilters/closePdfFilters/startPdfExport/getPeriodRange/pdfStatusOf/buildPdfHtml/renderAndPrint + getRenewalDate/daysUntil helpers), and full `@media print` block in `styles.css` (A4 page setup, `@bottom-center` footer with `Page X / Y · date`, header/title/summary/table, colored row highlights for expired/urgent, page-break-inside:avoid on rows)
- **Verified:** `node --check app.js` passes; all 8 new HTML IDs found in served files; CSS contains `@media print` + 4 new classes; JS contains 7 new functions and 5 new init listeners; all 8 IDs cross-check between HTML, JS, and CSS

### 2026-06-13 — Session 3 — Direct PDF download (replace print dialog)
- User reported: Chrome print dialog adds an uncontrollable `file:///.../index.html` footer, and the @media print approach produced a phantom blank first page. Asked for **direct file download** instead of going through the print dialog.
- Chose a custom vanilla-JS PDF generator vendored locally over jsPDF (offline constraint). User agreed.
- **Built:** new `pdf.js` (~14KB, zero deps) — `window.PDF` class with `text`/`rect`/`line`/`addPage`/`table` (with auto-pagination, header repeat, cell truncation)/`footer` (post-stamped on every page with correct total count)/`download`. PDF 1.4, 4 Type1 Helvetica variants with WinAnsiEncoding (handles é à ç · — … natively via octal escapes). Includes `?pdftest=1` self-test. Rewrote `app.js` PDF section: replaced `buildPdfHtml`/`renderAndPrint` with `preparePdfRows` (data step) + `buildPdfDoc` (layout step) + updated `startPdfExport` calling `doc.download(filename)`. Removed `#print-area` from `index.html`, simplified modal hint, removed entire `@media print` block and `.pdf-*` classes from `styles.css`.
- **Verified:** `node --check` passes on both `pdf.js` and `app.js`. Generated test PDFs in Node VM: 1-batch case = 1 page, 50 batches = 2 pages with `Page 1 / 2` and `Page 2 / 2` in footers, xref offsets correct, accents render correctly (é à ç · — … all present in BT/ET blocks), all 7 column headers render without truncation, expired/urgent row coloring works.
- **User reported "layout overlapping or broken":** Identified the issue — the first data row's white background rectangle was being drawn on top of the header's bottom border line (z-order bug), making the header separator invisible. Fix: defer the header's bottom border line to be drawn AFTER all data rows in `Table.end()`. Also widened the "Renouvellement" column from 60pt to 75pt (was truncating the header label) and gave the Total/Conformes tiles a light grey background for visual consistency.
- **Out of scope:** image/logo support in PDF, text wrap (currently single-line + ellipsis), custom filename format.

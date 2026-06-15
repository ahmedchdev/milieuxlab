# MilieuXlab — Project Context

> Living document. Updated automatically each turn in this session. Captures project map, decisions, current state, and session log.

---

## 1. Project Map

### Identity
- **App name:** MilieuXlab
- **Domain:** Culture Media Manager / Microbiology Analyst Tool
- **Type:** PWA (mobile-first, French UI, installable on Android + iOS)
- **Source spec:** `script-milieuxlab.md` (v2.0)
- **Working dir:** `C:\Users\ahmed\Desktop\MilieuXlab\`
- **Hosting:** Vercel (production at `https://milieuxlab-psi.vercel.app`)
- **Repo:** https://github.com/ahmedchdev/milieuxlab (branch `main`)
- **Background notifications:** Upstash Redis + GitHub Actions cron + Web Push (VAPID)

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

### App Structure — 4 Views
1. **Dashboard** — alert banner, 4 stat tiles, batch cards with progress bar + color-coded left stripe
2. **Register** — new batch form with live-calculated dates preview
3. **Media** — list/add/edit/delete media (defaults protected from delete)
4. **Settings** — lab name, notifications toggle, show-expired toggle, reset, active rules summary

### Design System

**Colors (dark theme)**
- Background: `#060810` (dark navy)
- Card: `#0f1421`
- Primary accent (solid/OK): `#60a5fa` (blue) → also used for success paths
- Secondary accent: `#22d3ee` (cyan)
- Success: `#26de81` (green)
- Warning: `#fbbf24` (amber) — expiry < 7d
- Danger: `#ff4757` (red) — renewal overdue
- Lab (broth tag): `#4ade80` / `#10b981` (green tones)

**Light theme** (added in session 2026-06-15)
- Background: `#ffffff`
- Surface: `#ffffff`
- Accent: `#1d4ed8` (deeper blue for proper contrast on white)
- Same status colors but with adjusted text-on-accent

**Typography**
- Display + body: **Inter** (weights 400/500/600/700/800)
- Mono (labels, codes, dates): **JetBrains Mono** (400/500/700)

**Card left-border status colors**
- Green: in progress, no issue
- Orange: expiry within 7 days
- Red: renewal alert passed
- Grey (dimmed): expired (only if setting enabled)

**Theme switching**
- `data-theme="dark"` | `data-theme="light"` set on `<html>`
- Stored in `localStorage['milieuxlab.theme.v1']`
- Inline script in `<head>` applies theme before first paint to avoid flash
- Header button (sun/moon icon) toggles it

### Alert Triggers
- 🔴 Renewal date reached → "Prepare a new batch"
- 🟡 Fertility result due today
- 🟡 Sterility result due today
- 🔴 Expiry date reached → "BATCH EXPIRES TODAY"

Channels: visual banner on dashboard, OS push notifications (when PWA installed + VAPID configured).

### Data Model (in localStorage)
- **Media** { id, name, type, shelfLifeDays, strain, fertilityDelayDays, sterilityFormat, sterilityValue, sterilityMinHours, sterilityMaxHours, isDefault }
- **Batch** { id, mediumId, lotNumber, prepDate, prepTime, fertilityResultDate, sterilityResultDate, expiryDate, renewalAlertDate }
- **Settings** { browserNotifications, showExpired, labName }

### Media Management Rules
- View: all users see default + custom
- Add custom: user, saved permanently
- Edit any: user (defaults editable)
- Delete custom: user, with confirm
- Delete default: **not allowed** (protected)

---

## 2. Current State

### File structure
```
C:\Users\ahmed\Desktop\MilieuXlab\
├── index.html        — full app shell (header, views, modals, install gate)
├── styles.css        — design system + all components (light/dark themes)
├── app.js            — state, calculations, rendering, PWA, calendar, push
├── pdf.js            — vendored PDF generator (~14KB, zero deps, offline)
├── sw.js             — Service Worker (offline cache + push handler)
├── manifest.json     — PWA manifest (192/512/maskable icons + shortcuts)
├── build-icons.js    — pure-JS PNG icon generator
├── icons/            — icon-192.png, icon-512.png, icon-maskable-512.png, icon.svg
├── api/
│   ├── save-subscription.js   — POST: register push endpoint + batch state
│   ├── vapid-public.js        — GET: returns VAPID public key
│   └── cron-check-alerts.js   — GET/POST: re-evaluate, send Web Push
├── .github/workflows/
│   ├── alerts-cron.yml        — every 5 min, hits /api/cron-check-alerts
│   └── deploy-vercel.yml      — DISABLED (use Vercel GitHub integration)
├── vercel.json       — build config + headers (cron in GitHub Actions, not Vercel)
├── package.json      — @upstash/redis + web-push deps
├── package-lock.json — generated for deterministic installs
└── README.md         — deployment guide
```

### Stack
- **Frontend:** vanilla HTML/CSS/JS, no framework, no build step
- **Service Worker:** vanilla, no Workbox
- **Backend:** Vercel Serverless Functions (Node 20)
- **Storage:** Upstash Redis (free tier)
- **Cron:** GitHub Actions (free, every 5 min)
- **Push:** Web Push API + VAPID (no FCM needed for Android; works on iOS PWA)

### Run locally
```bash
npm run dev   # starts a static server on http://localhost:3000
```

### Deployment
- GitHub → Vercel auto-deploy on every push to `main`
- Env vars on Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or legacy `KV_REST_API_URL` / `KV_REST_API_TOKEN`)
- Cron: GitHub Actions → `/api/cron-check-alerts` every 5 min
- Vercel cron NOT used (Hobby tier caps at 2/day)
- Vercel KV @deprecated; we use `@upstash/redis` (Upstash integration)

### Key URLs
- **Production:** `https://milieuxlab-psi.vercel.app`
- **Vercel project ID:** `milieuxlab-m4tiziddd-ahmedchdevs-projects`
- **Vercel dashboard:** https://vercel.com/milieuxlab-m4tiziddd-ahmedchdevs-projects
- **Cron endpoint:** `/api/cron-check-alerts` — returns `{ok, sent, skipped, errors, scanned}`

### Implementation Notes

**Date math:** `computeBatchDates(medium, prep)` returns fertility/sterility/expiry/renewal; buffer = 2 days. Sterility duration: `days` | `hours` | `range (min/max hours)`; range uses **max** for display.

**Browser notifications (in-app, no install needed):**
- 5-min `setInterval` poller (`startNotificationPoller()`) re-checks alerts
- Only fires when:
  - tab is hidden (`document.hidden === true`)
  - alert signature changed since last check
  - browser permission is `granted`
- Initial load also fires once if tab is hidden

**PWA install gate (browser tab):**
- `isInstalledPWA()` checks `display-mode: standalone` (Android) or `navigator.standalone` (iOS)
- In browser tab → show install gate (never let the dashboard render)
- In installed PWA → show welcome toast on first launch, then dashboard
- Two buttons: green Android (triggers `beforeinstallprompt`) + blue iPhone (opens modal)
- After Android install accepted, `appinstalled` event → success modal pops up
- Body gets `has-install-gate` class → CSS hides `.app` so the dashboard can't leak
- JS also skips `renderDashboard()` and the poller when the gate is shown

**Service Worker (`sw.js`):**
- Cache name: `milieuxlab-v4` (bump on each push to force update)
- Pre-caches app shell on install
- Cache-first fetch for same-origin GET
- Network-first for `/api/*`
- Listens for `push` event → calls `showNotification()`
- Listens for `message` → `SKIP_WAITING` for instant takeover
- Listens for `notificationclick` → opens/focuses app

**SW update toast (the "Nouvelle version" prompt):**
- On app launch, `reg.update()` is called to force a check
- When new SW is `installed`, toast appears at bottom: "Nouvelle version disponible — appuyez pour actualiser."
- Toast stays visible until user taps (no auto-activate)
- Tap → `SKIP_WAITING` → `controllerchange` fires → page reloads 300ms later
- Only reloads if the user explicitly tapped (not on auto-controllerchange)

**Theme toggle (dark/light):**
- Inline `<head>` script reads `localStorage['milieuxlab.theme.v1']` and sets `data-theme` before paint
- `[data-theme="dark"]` = `:root` (default)
- `[data-theme="light"]` overrides color tokens
- All hardcoded `rgba(...)` values replaced with CSS variables

**Calendar (header button):**
- Replaces the old count pill in the header
- Opens a month view with prev/next navigation
- Days colorized:
  - **Red** = renewal needed (urgent OR soon, today or past)
  - **Yellow** = expired (only AFTER the day has passed)
  - Today has a blue border
- Click a day with activity → day-details modal opens with full batch info
- 6 legend items collapsed to 3: Conforme (green), Renouvellement (red), Expiré (yellow)
- Calendar badge on the button shows urgent count (pulsing red)

**PDF export** (`.pdf`, A4 landscape):
- File: `pdf.js` (~14KB, zero deps, vendored)
- Trigger: "⤓ PDF" button in dashboard → filter modal (period + urgent-only) → builds real PDF Blob → triggers download
- API: `new PDF()`, `.text()`, `.rect()`, `.line()`, `.addPage()`, `.table()` (auto-pagination + header repeat + cell truncation), `.footer()` (post-stamped on every page), `.download()`
- Per-cell backgrounds and text colors supported via `cellBgs` / `cellTextColors` opts
- PDF 1.4, 4 built-in Helvetica variants with WinAnsiEncoding (handles é à ç · — … natively)
- Landscape orientation gives 758pt of horizontal space (vs 510pt portrait)
- Column widths `[180, 110, 95, 95, 100, 80, 98]` prevent truncation for "BHI Chocolat Agar" etc.
- Renouvellement column has soft red background (#FCE4E4) + dark red text (#7F1D1D)
- Header divider line at y=100, below the "Généré le …" text with breathing room

**Local notification poller (in-app fallback):**
- `setInterval(5 * 60 * 1000)` re-evaluates alerts
- Skips if tab is visible (in-app banner handles it)
- Skips if alert signature unchanged
- Always runs in addition to the Vercel cron (defense in depth)

**Welcome toast (first install only):**
- Triggered when `isInstalledPWA()` returns true on first launch
- Stored in `localStorage['milieuxlab.welcomed.v1']`
- 4.5s duration, French text: "Application installée — retrouvez MilieuXlab sur votre écran d'accueil."

**Success modal (post-install):**
- Triggered by `appinstalled` event
- Green checkmark icon with pulsing glow
- "Application installée" title + French message
- User taps "Compris" to close

**Dashboard blocking in browser (CRITICAL):**
- The dashboard MUST only render inside the installed PWA
- In a regular browser tab, the install gate is shown and the dashboard is hidden
- Two safeguards: CSS `body.has-install-gate .app { display: none; }` AND JS skip of `renderDashboard()`
- The install button does NOT remove the gate when accepted (it only opens the success modal) — this prevents the dashboard from showing in the browser tab after install
- User must close Chrome and open the app from the home screen to see the dashboard

---

## 3. Open Questions / Decisions Needed

None.

---

## 4. Session Log

### 2026-06-12 — Session 1
- User introduced project MilieuXlab and asked to read `script-milieuxlab.md`
- Read full spec (365 lines): culture media tracker for microbiology analysts
- Created this `CLAUDE.md` to persist project context across the session
- User said: build it fresh, mobile-first, responsive, clean & attractive UI
- **Built:** `index.html` (4 tabs), `styles.css` (dark theme, full design system), `app.js` (state, calc, render, localStorage, notifications)
- **Verified:** files serve 200 on Node static server, `app.js` passes `node --check`, all `getElementById` refs match HTML IDs

### 2026-06-13 — Session 2 — PDF Export (initial, print dialog)
- Built window.print() + @media print path with PDF-ready CSS
- Lab name persisted in Réglages

### 2026-06-13 — Session 3 — Direct PDF download (replace print dialog)
- Vendored vanilla-JS PDF generator (`pdf.js` ~14KB, zero deps)
- Built `window.PDF` class with text/rect/line/addPage/table/footer/download
- **Verified:** 1-batch case = 1 page, 50 batches = 2 pages, accents render correctly

### 2026-06-15 — Session 4 — Theme toggle + iOS install gate
- Added dark/light theme tokens (`:root, [data-theme="dark"]` + `[data-theme="light"]`)
- Inline `<head>` script applies theme before paint (no flash)
- Built splash/install gate with two-button picker (Android + iPhone)
- Modal-based iOS instructions with 4 numbered steps
- Fixed CSS brace-balance bug (duplicate `}` after `.dashboard-hero`)

### 2026-06-15 — Session 5 — PWA + Web Push on Vercel
- Created `manifest.json`, `sw.js` (Service Worker), `build-icons.js` (pure-JS PNG gen)
- Built install gate: real "Installer maintenant" button for Android (via `beforeinstallprompt`), modal for iPhone
- Created Vercel API routes: `/api/save-subscription`, `/api/vapid-public`, `/api/cron-check-alerts`
- Used `@vercel/kv` initially, later switched to `@upstash/redis` (Upstash for Redis on Vercel Marketplace)
- `vercel.json` with `buildCommand`, `outputDirectory`, `functions: { "api/*.js": { maxDuration: 60 } }`
- Wrote full README with deployment guide

### 2026-06-15 — Session 6 — GitHub Actions cron
- Created `.github/workflows/alerts-cron.yml` (5-min cron, free, no Vercel Pro needed)
- Created `.github/workflows/deploy-vercel.yml` (later disabled with `if: false`)
- Generated `package-lock.json` for Vercel CLI install
- Switched from `@vercel/kv` (deprecated) to `@upstash/redis`
- Code falls back gracefully between `UPSTASH_REDIS_REST_URL` and `KV_REST_API_URL`

### 2026-06-15 — Session 7 — First real deployment
- User signed up for Vercel + imported the GitHub repo
- Production URL: `https://milieuxlab-psi.vercel.app`
- Created Upstash for Redis database (env vars: `KV_REST_API_URL`, `KV_REST_API_TOKEN`)
- Added VAPID env vars
- Cron endpoint returns `{"ok":true,"sent":0,"skipped":0,"errors":0,"scanned":0}`

### 2026-06-15 — Session 8 — Fixes + Calendar
- Removed hardcoded `_comment` from `vercel.json` (Vercel rejects unknown props)
- Added `.gitignore` (excludes `node_modules/`, `.env*`, `.claude/`, test files)
- Built the calendar view: replaces the old count pill in the header
  - Month grid with prev/next navigation
  - Days colorized: red (renewal), yellow (expired, only after date passed)
  - Click a day → day-details modal with full batch info
- Added install-success modal (after `appinstalled` event) + welcome toast (first install)
- Fixed bug: dashboard was showing in browser after install because the install handler removed the `has-install-gate` class — now the gate stays visible in the browser tab even after install
- Switched PDF to A4 landscape with wider columns; added soft red background to Renouvellement column

### 2026-06-15 — Session 9 — SW update toast + polish
- Added Service Worker update detection: `reg.update()` on launch, updatefound listener
- Toast "Nouvelle version disponible — appuyez pour actualiser." appears at bottom
- User taps toast → SKIP_WAITING → controllerchange → page reloads
- Cache name bumped v1 → v2 → v3 → v4 to force SW replacement
- Calendar legend cleaned up: removed "Bientôt", only Renouvellement + Expiré remain
- Expiry day color only shows after the day has passed (not on day-of)
- PDF header divider line moved from y=90 to y=100 (below the "Généré le …" text with breathing room)

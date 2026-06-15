# MilieuXlab — PWA + Web Push on Vercel

A complete lab tracking PWA with **background push notifications** that work
even when the browser tab is closed. Built on the mission-control design
system from `nexu-io/open-design`.

## What's included

- `index.html` — single-page app, 4 views
- `styles.css` — mission-control dark/light theme
- `app.js` — state, calculations, rendering, PWA install gate
- `pdf.js` — vendored PDF generator
- `manifest.json` — PWA manifest
- `sw.js` — Service Worker (offline cache + push handler)
- `icons/` — PWA icons (192, 512, maskable-512)
- `api/save-subscription.js` — Vercel function: register push subscription
- `api/vapid-public.js` — Vercel function: return VAPID public key
- `api/cron-check-alerts.js` — Vercel Cron: every 5 min, push alerts
- `vercel.json` — cron schedule config
- `package.json` — deps + dev script

## Deploy to Vercel (5 minutes)

### 1. Create a Vercel project

```bash
npm i -g vercel
vercel link
```

Or push to GitHub and import the repo on vercel.com.

### 2. Generate VAPID keys

VAPID keys are used to sign push messages. Generate them once:

```bash
npx web-push generate-vapid-keys
```

Output:
```
======================================
Public Key:
BPl4M7XfO0VQX9yZ3GvK8nK4R7yYpZ4dC8dK8nK4R7yYpZ4dC8dK8nK4R7yYpZ4
Private Key:
XyZ_PRIVATE_KEY_HERE
======================================
```

### 3. Add Vercel KV integration

In the Vercel dashboard:
- Go to your project → **Storage** tab → **Create Database** → **KV**
- Vercel automatically populates `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars.

### 4. Set environment variables

In Vercel project → **Settings** → **Environment Variables**, add:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | from step 2 |
| `VAPID_PRIVATE_KEY` | from step 2 |
| `VAPID_SUBJECT` | `mailto:you@yourdomain.com` |

### 5. Deploy

```bash
vercel --prod
```

Done. Your app is now a live PWA with Web Push.

## How users install

**Android (Chrome):** open the URL → menu ⋮ → "Install app" or "Add to Home Screen"

**iPhone / iPad (Safari):** open the URL → tap Share → "Add to Home Screen"

When the app is opened in a regular browser tab, a **splash/install gate** is
shown that explains the install process. The gate disappears once the app is
launched in standalone mode.

## How notifications work

1. User installs the PWA on their device
2. First launch, browser asks permission for notifications
3. Service Worker (`sw.js`) registers in the background
4. App fetches `/api/vapid-public` for the public VAPID key
5. App calls `pushManager.subscribe(...)` to register a push endpoint
6. Subscription + current batch state is POSTed to `/api/save-subscription`
7. Vercel stores them in KV
8. **Every 5 minutes**, Vercel Cron hits `/api/cron-check-alerts`:
   - For each device: re-evaluate batch status from the stored state
   - If alert set changed since last check → send Web Push
9. The browser's push service (FCM on Chrome, Autopush on Firefox) wakes
   the Service Worker
10. SW calls `registration.showNotification(...)` — OS toast appears

This works even if the **browser is closed** because the push service keeps
a separate process alive for registered service workers.

## Local development

```bash
npm run dev
```

Open `http://localhost:3000`. The install gate will appear (because you're
not in standalone mode). To test push locally, you'd need to use a tool
like `ngrok` to expose localhost as HTTPS — but for the install-gate flow
itself, localhost is enough.

## Caveats

- **iOS Safari** requires the user to **add the PWA to Home Screen** before
  push works. The install gate explicitly tells them this.
- **iOS push is unreliable** when the OS is in Low Power Mode or has
  backgrounded the SW. Android push is significantly more reliable.
- **Vercel Hobby cron is capped at 2/day** — the 5-min schedule is
  delegated to **GitHub Actions** (`.github/workflows/alerts-cron.yml`),
  which hits `/api/cron-check-alerts` every 5 minutes. Free, no daily cap.

## Deployment & cron (GitHub Actions)

The project ships with two GitHub Actions workflows:

- `.github/workflows/alerts-cron.yml` — fires every 5 minutes via
  `schedule: cron: "*/5 * * * *"`. Each run `curl`s
  `https://milieuxlab.vercel.app/api/cron-check-alerts`, which re-evaluates
  every device's stored batch state and sends Web Push for any whose
  alert set has changed. Free for both public and private repos
  (private: 2000 min/month, enough for ~13k runs of this workflow).
- `.github/workflows/deploy-vercel.yml` — auto-deploys to Vercel on
  every push to `main`. Requires a `VERCEL_TOKEN` secret in the repo
  (Settings → Secrets → Actions). Alternative: connect the GitHub repo
  to your Vercel project in the Vercel dashboard and skip this file.

The default URL is `https://milieuxlab.vercel.app` — change it in the
workflow files (or set a repo variable and reference `$VARS.APP_URL`)
once you have a custom domain.

## What works without Web Push (iOS fallback)

If the user installs the PWA on iOS but Web Push is denied or unreliable,
the **local notification poller** in `app.js` (5-min `setInterval`) still
fires OS notifications while the tab is open. The Service Worker also
runs a `push` event handler for when Web Push is delivered, so this is a
defense-in-depth setup.

## Files to check before deploying

- [ ] VAPID keys generated and set as Vercel env vars
- [ ] Vercel KV integration installed
- [ ] `package.json` has `@vercel/kv` and `web-push` (Vercel installs on build)
- [ ] GitHub Actions cron workflow enabled (Settings → Actions → Allow)
- [ ] (Optional) `VERCEL_TOKEN` secret added for auto-deploy workflow
- [ ] Domain is HTTPS (Vercel does this automatically)

## License

Apache-2.0

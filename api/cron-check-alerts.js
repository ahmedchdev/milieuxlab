// /api/cron-check-alerts
// Called every 5 minutes by .github/workflows/alerts-cron.yml.
// Re-evaluates batch status for each device's stored state, and sends
// a Web Push to any device whose alert set has changed.
//
// Storage: Upstash Redis (via @upstash/redis), env vars:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//   VAPID_SUBJECT

import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const BUFFER_DAYS = 2;
const SHELF_LIFE = { solid: 30, broth: 15 };

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }

function batchStatus(batch, now = new Date()) {
  const expiry = new Date(batch.expiryDate);
  const renewal = new Date(batch.renewalAlertDate);
  const fert = new Date(batch.fertilityResultDate);
  const ster = new Date(batch.sterilityResultDate);
  const isSameDay = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  if (now > expiry) return { code: 'expired', label: 'Expiré' };
  if (now >= renewal) return { code: 'urgent', label: 'Renouvellement requis' };
  if (daysBetween(now, expiry) <= 7) return { code: 'soon', label: 'Expiration proche' };
  if (isSameDay(now, fert)) return { code: 'fert-today', label: 'Résultat fertilité' };
  if (isSameDay(now, ster)) return { code: 'ster-today', label: 'Résultat stérilité' };
  return { code: 'ok', label: 'En cours' };
}

function computeAlerts(batches) {
  const out = [];
  batches.forEach(b => {
    const s = batchStatus(b);
    if (s.code === 'urgent')  out.push({ batchId: b.id, msg: 'Renouvellement requis' });
    else if (s.code === 'expired') out.push({ batchId: b.id, msg: 'Expiré' });
    else if (s.code === 'fert-today') out.push({ batchId: b.id, msg: 'Résultat fertilité' });
    else if (s.code === 'ster-today') out.push({ batchId: b.id, msg: 'Résultat stérilité' });
  });
  return out;
}

function alertSignature(alerts) {
  return alerts.slice().sort((a, b) => (a.batchId || '').localeCompare(b.batchId || ''))
    .map(a => `${a.batchId}:${a.msg}`).join('|');
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) ||
      !(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)) {
    return res.status(500).json({ error: 'Upstash Redis not configured' });
  }

  let sent = 0, skipped = 0, errors = 0, scanned = 0;

  try {
    // Get all subscription keys (we use * since we don't expect many)
    const keys = await redis.keys('sub:*');
    scanned = Array.isArray(keys) ? keys.length : 0;

    for (const key of keys) {
      const entry = await redis.get(key);
      if (!entry || typeof entry !== 'object') continue;
      const fresh = computeAlerts(entry.batches || []);
      const sig = alertSignature(fresh);
      if (sig === entry._lastSig) { skipped++; continue; }
      if (fresh.length === 0) {
        await redis.set(key, { ...entry, _lastSig: sig });
        skipped++;
        continue;
      }
      try {
        await webpush.sendNotification(entry.subscription, JSON.stringify({
          title: `MilieuXlab — ${fresh.length} alerte${fresh.length > 1 ? 's' : ''}`,
          body: fresh.slice(0, 3).map(a => `• ${a.msg}`).join('\n'),
          tag: 'milieuxlab-alert',
          urgent: fresh.some(a => a.msg === 'Expiré' || a.msg === 'Renouvellement requis'),
          url: './index.html#dashboard',
        }));
        await redis.set(key, { ...entry, _lastSig: sig });
        sent++;
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await redis.del(key);
        }
        errors++;
      }
    }
  } catch (e) {
    console.error('cron-check-alerts failed:', e);
    return res.status(500).json({ error: 'Internal error', detail: e.message });
  }

  return res.status(200).json({ ok: true, sent, skipped, errors, scanned });
}

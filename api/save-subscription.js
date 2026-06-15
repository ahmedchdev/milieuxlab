// /api/save-subscription
// Receives a push subscription + batch state from a PWA client and stores
// it in Vercel KV. Also returns the public VAPID key the client needs to
// subscribe.
//
// Request body: { subscription: PushSubscription, batches: [...], media: [...] }
//
// Required env vars (set in Vercel dashboard):
//   KV_REST_API_URL          — from Vercel KV integration
//   KV_REST_API_TOKEN        — from Vercel KV integration
//   VAPID_PUBLIC_KEY         — `npx web-push generate-vapid-keys` then set
//   VAPID_PRIVATE_KEY        — same
//   VAPID_SUBJECT            — mailto:you@example.com

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscription, batches = [], media = [] } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' });
  }

  // Identify the device by endpoint hash — each browser/device gets one entry.
  // The user can have multiple devices (phone + laptop).
  const id = 'sub:' + Buffer.from(subscription.endpoint).toString('base64url').slice(0, 40);

  try {
    await kv.set(id, {
      subscription,
      batches,
      media,
      updatedAt: new Date().toISOString(),
    }, { ex: 60 * 60 * 24 * 90 }); // 90 days; cron refreshes

    return res.status(200).json({
      ok: true,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    });
  } catch (e) {
    console.error('save-subscription failed:', e);
    return res.status(500).json({ error: 'Storage error' });
  }
}

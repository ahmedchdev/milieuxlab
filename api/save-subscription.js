// /api/save-subscription
// Receives a Web Push subscription + batch state from a PWA client and
// stores it in Upstash Redis.
//
// Required env vars:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   VAPID_PUBLIC_KEY (returned in response so the client doesn't need to fetch separately)

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscription, batches = [], media = [] } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' });
  }

  // Identify the device by endpoint hash — each browser/device gets one entry
  const id = 'sub:' + Buffer.from(subscription.endpoint).toString('base64url').slice(0, 40);

  try {
    await redis.set(id, {
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
    return res.status(500).json({ error: 'Storage error', detail: e.message });
  }
}

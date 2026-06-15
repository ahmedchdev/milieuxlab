// /api/vapid-public
// Returns the public VAPID key to clients. Public by design — this is what the
// browser's PushManager needs to subscribe.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  });
}

export default function handler(req, res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return res.status(500).json({ error: "VAPID_PUBLIC_KEY não configurada." });
  res.status(200).json({ publicKey });
}

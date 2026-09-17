import { list } from '@vercel/blob';
import Stripe from 'stripe';

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function loadDocument(docId) {
  const { blobs } = await list({ prefix: `documents/${docId}/` });
  // Prior duplicate blobs from before put() was fixed to overwrite in place
  // can still exist — pick the most recently uploaded match, not list() order.
  const metaBlobs = blobs.filter(b => b.pathname.endsWith('metadata.json'))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const metaBlob = metaBlobs[0];
  if (!metaBlob) return null;
  const res = await fetch(metaBlob.url);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Payments aren\'t configured yet — STRIPE_SECRET_KEY is missing on this project.' });
  }

  try {
    const { docId, tierIndex, billing } = await readBody(req);
    if (!docId || tierIndex === undefined) {
      return res.status(400).json({ error: 'docId and tierIndex are required' });
    }
    const isMonthly = billing === 'monthly';

    const doc = await loadDocument(docId);
    if (!doc) return res.status(404).json({ error: 'Pitch not found' });

    // The price is always read back from the stored document, never trusted
    // from the client — a tampered tierIndex just 404s on a bad index above,
    // it can never smuggle a different amount through.
    const tierList = isMonthly ? doc.hostingTiers : doc.pricingTiers;
    const tier = Array.isArray(tierList) ? tierList[tierIndex] : null;
    if (!tier) return res.status(400).json({ error: 'That pricing tier does not exist for this pitch' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: isMonthly ? 'subscription' : 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(tier.price * 100),
          ...(isMonthly ? { recurring: { interval: 'month' } } : {}),
          product_data: {
            name: `${doc.clientName} — ${tier.name}`,
            description: tier.description || undefined,
          },
        },
        quantity: 1,
      }],
      success_url: `https://visionfarm.tech/view?id=${docId}&paid=1`,
      cancel_url: `https://visionfarm.tech/view?id=${docId}`,
      metadata: { docId, tierName: tier.name, clientName: doc.clientName, billing: isMonthly ? 'monthly' : 'once' },
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Could not start checkout', message: error.message });
  }
}

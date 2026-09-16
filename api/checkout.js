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
  const metaBlob = blobs.find(b => b.pathname.endsWith('metadata.json'));
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
    const { docId, tierIndex } = await readBody(req);
    if (!docId || tierIndex === undefined) {
      return res.status(400).json({ error: 'docId and tierIndex are required' });
    }

    const doc = await loadDocument(docId);
    if (!doc) return res.status(404).json({ error: 'Pitch not found' });

    const tier = Array.isArray(doc.pricingTiers) ? doc.pricingTiers[tierIndex] : null;
    if (!tier) return res.status(400).json({ error: 'That pricing tier does not exist for this pitch' });

    // The price is always read back from the stored document, never trusted
    // from the client — a tampered tierIndex just 404s on a bad index above,
    // it can never smuggle a different amount through.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(tier.price * 100),
          product_data: {
            name: `${doc.clientName} — ${tier.name}`,
            description: tier.description || undefined,
          },
        },
        quantity: 1,
      }],
      success_url: `https://visionfarm.tech/view?id=${docId}&paid=1`,
      cancel_url: `https://visionfarm.tech/view?id=${docId}`,
      metadata: { docId, tierName: tier.name, clientName: doc.clientName },
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Could not start checkout', message: error.message });
  }
}

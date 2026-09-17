import { put } from '@vercel/blob';
import { createHash } from 'crypto';

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

function isValidHttpUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanTierList(tiers) {
  return Array.isArray(tiers)
    ? tiers
        .filter(t => t && t.name && t.price)
        .map(t => ({
          name: String(t.name).trim(),
          price: Math.round(Number(t.price) * 100) / 100, // dollars, 2dp
          description: t.description ? String(t.description).trim() : '',
        }))
        .filter(t => Number.isFinite(t.price) && t.price > 0)
    : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { clientName, docTitle, description, siteUrl, password, slug, price, services, pricingTiers, hostingTiers } = await readBody(req);

    if (!clientName || !docTitle || !siteUrl) {
      return res.status(400).json({ error: 'Client name, title, and site URL are required' });
    }
    if (!isValidHttpUrl(siteUrl)) {
      return res.status(400).json({ error: 'Site URL must be a valid http:// or https:// link' });
    }

    // A custom slug is intentionally an upsert, not a create-once: the same
    // admin re-submitting "la-fritanga" with updated pricing/services is
    // editing that pitch in place, not colliding with someone else's link.
    let docId;
    if (slug && slug.trim()) {
      docId = slugify(slug);
      if (!docId) {
        return res.status(400).json({ error: 'That custom link has no usable characters — use letters, numbers, and dashes' });
      }
    } else {
      docId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    const document = {
      id: docId,
      type: 'website',
      clientName,
      docTitle,
      description: description || '',
      siteUrl,
      price: price || '',
      services: Array.isArray(services) ? services.filter(Boolean) : [],
      pricingTiers: cleanTierList(pricingTiers),
      hostingTiers: cleanTierList(hostingTiers),
      uploadDate: new Date().toISOString(),
      link: `https://visionfarm.tech/view?id=${docId}`,
      passwordHash: password ? createHash('sha256').update(password).digest('hex') : null,
    };

    // Without addRandomSuffix:false, @vercel/blob appends a random suffix on
    // every put() instead of overwriting — so re-sharing the same slug would
    // silently pile up stale copies instead of updating the live one.
    await put(`documents/${docId}/metadata.json`, JSON.stringify(document), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return res.status(200).json({ success: true, document });
  } catch (error) {
    console.error('Share-site error:', error);
    return res.status(500).json({ error: 'Failed to create share link', message: error.message });
  }
}

import { put, list } from '@vercel/blob';

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
  const metaBlobs = blobs.filter(b => b.pathname.endsWith('metadata.json'))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const metaBlob = metaBlobs[0];
  if (!metaBlob) return null;
  const res = await fetch(metaBlob.url);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { docId, name, contact, budget, message } = await readBody(req);

    if (!docId || !name || !contact) {
      return res.status(400).json({ error: 'docId, name, and contact are required' });
    }

    const doc = await loadDocument(docId);

    const inquiryId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const inquiry = {
      id: inquiryId,
      docId,
      clientName: doc ? doc.clientName : docId,
      docTitle: doc ? doc.docTitle : docId,
      name: String(name).trim(),
      contact: String(contact).trim(),
      budget: budget ? String(budget).trim() : '',
      message: message ? String(message).trim() : '',
      createdAt: new Date().toISOString(),
    };

    await put(`inquiries/${docId}/${inquiryId}.json`, JSON.stringify(inquiry), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Custom inquiry error:', error);
    return res.status(500).json({ error: 'Could not send that — try again', message: error.message });
  }
}

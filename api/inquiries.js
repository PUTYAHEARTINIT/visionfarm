import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { blobs } = await list({ prefix: 'inquiries/' });
    const jsonBlobs = blobs.filter(b => b.pathname.endsWith('.json'));

    const inquiries = await Promise.all(
      jsonBlobs.map(async b => {
        const r = await fetch(b.url);
        return r.json();
      })
    );

    inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({ success: true, inquiries });
  } catch (error) {
    console.error('Inquiries list error:', error);
    return res.status(500).json({ error: 'Could not load inquiries', message: error.message });
  }
}

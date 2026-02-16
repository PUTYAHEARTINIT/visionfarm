import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Document ID is required' });
  }

  try {
    // List all blobs in the document's folder
    const { blobs } = await list({
      prefix: `documents/${id}/`,
    });

    if (blobs.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Find metadata file
    const metadataBlob = blobs.find(b => b.pathname.endsWith('metadata.json'));

    if (!metadataBlob) {
      return res.status(404).json({ error: 'Document metadata not found' });
    }

    // Fetch metadata
    const response = await fetch(metadataBlob.url);
    const document = await response.json();

    return res.status(200).json({
      success: true,
      document
    });

  } catch (error) {
    console.error('Retrieval error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve document',
      message: error.message
    });
  }
}

import { put } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const LOGO_PATH = join(process.cwd(), 'logo-watermark.png');

async function watermarkPDF(pdfBuffer, logoPath) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const logoBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const pages = pdfDoc.getPages();
  const logoScale = 0.2;
  const logoDims = logoImage.scale(logoScale);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const spacingX = logoDims.width * 2;
    const spacingY = logoDims.height * 2;

    for (let y = -spacingY; y < height + spacingY; y += spacingY) {
      for (let x = -spacingX; x < width + spacingX; x += spacingX) {
        page.drawImage(logoImage, {
          x, y,
          width: logoDims.width,
          height: logoDims.height,
          opacity: 0.25,
        });
      }
    }
  }

  return await pdfDoc.save();
}

async function watermarkImage(imageBuffer, logoPath) {
  const metadata = await sharp(imageBuffer).metadata();
  const logoSize = Math.min(metadata.width, metadata.height) / 5;

  const logoWithOpacity = await sharp(logoPath)
    .resize(Math.floor(logoSize))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = logoWithOpacity;
  for (let i = 0; i < data.length; i += info.channels) {
    if (info.channels === 4) data[i + 3] = Math.floor(data[i + 3] * 0.25);
  }

  const logo = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels }
  }).png().toBuffer();

  const logoMeta = { width: info.width, height: info.height };
  const spacing = 1.5;
  const tilesX = Math.ceil(metadata.width / (logoMeta.width * spacing)) + 1;
  const tilesY = Math.ceil(metadata.height / (logoMeta.height * spacing)) + 1;

  const composites = [];
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      composites.push({
        input: logo,
        top: Math.floor(y * logoMeta.height * spacing),
        left: Math.floor(x * logoMeta.width * spacing),
        blend: 'over'
      });
    }
  }

  return await sharp(imageBuffer).composite(composites).toBuffer();
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { blobUrl, fileName, mimeType, clientName, docTitle, description } = await readBody(req);

    if (!blobUrl || !clientName || !docTitle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Download original file from Vercel Blob
    const fileResponse = await fetch(blobUrl);
    if (!fileResponse.ok) throw new Error('Failed to download uploaded file');
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    // Apply watermark
    let watermarkedBuffer;
    let finalMimeType = mimeType;
    let finalFileName = fileName;

    if (mimeType === 'application/pdf') {
      watermarkedBuffer = await watermarkPDF(buffer, LOGO_PATH);
    } else if (mimeType.startsWith('image/')) {
      watermarkedBuffer = await watermarkImage(buffer, LOGO_PATH);
      finalMimeType = 'image/png';
      finalFileName = fileName.replace(/\.[^.]+$/, '.png');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Upload PDF or image.' });
    }

    const docId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const blob = await put(`documents/${docId}/${finalFileName}`, watermarkedBuffer, {
      access: 'public',
      contentType: finalMimeType,
    });

    const document = {
      id: docId,
      clientName,
      docTitle,
      description: description || '',
      fileName: finalFileName,
      fileUrl: blob.url,
      uploadDate: new Date().toISOString(),
      link: `https://visionfarm.tech/view?id=${docId}`
    };

    await put(`documents/${docId}/metadata.json`, JSON.stringify(document), {
      access: 'public',
      contentType: 'application/json',
    });

    return res.status(200).json({ success: true, document });

  } catch (error) {
    console.error('Watermark error:', error);
    return res.status(500).json({ error: 'Watermark failed', message: error.message });
  }
}

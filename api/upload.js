import { put } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load VisionFarm logo for watermarking
const LOGO_PATH = join(process.cwd(), 'logo-watermark.png');

export const config = {
  api: {
    bodyParser: false,
  },
};

// Parse multipart form data
async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundary = req.headers['content-type'].split('boundary=')[1];

      if (!boundary) {
        return reject(new Error('No boundary found'));
      }

      const parts = buffer.toString('binary').split(`--${boundary}`);
      const fields = {};
      let fileData = null;
      let fileName = '';
      let mimeType = '';

      for (const part of parts) {
        if (part.includes('Content-Disposition')) {
          const nameMatch = part.match(/name="([^"]+)"/);
          const filenameMatch = part.match(/filename="([^"]+)"/);
          const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);

          if (filenameMatch) {
            fileName = filenameMatch[1];
            mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

            // Extract file data (after double CRLF)
            const dataStart = part.indexOf('\r\n\r\n') + 4;
            const dataEnd = part.lastIndexOf('\r\n');
            if (dataStart > 3 && dataEnd > dataStart) {
              fileData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
            }
          } else if (nameMatch) {
            const fieldName = nameMatch[1];
            const dataStart = part.indexOf('\r\n\r\n') + 4;
            const dataEnd = part.lastIndexOf('\r\n');
            if (dataStart > 3 && dataEnd > dataStart) {
              fields[fieldName] = part.substring(dataStart, dataEnd);
            }
          }
        }
      }

      resolve({ fields, file: fileData, fileName, mimeType });
    });
    req.on('error', reject);
  });
}

// Watermark PDF with tiled logo at 25% opacity
async function watermarkPDF(pdfBuffer, logoPath) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const logoBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const pages = pdfDoc.getPages();
  const logoScale = 0.2; // Scale logo to 20% of original size
  const logoDims = logoImage.scale(logoScale);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Calculate tile spacing (diagonal pattern)
    const spacingX = logoDims.width * 2;
    const spacingY = logoDims.height * 2;

    // Tile the logo across the page in a diagonal pattern
    for (let y = -spacingY; y < height + spacingY; y += spacingY) {
      for (let x = -spacingX; x < width + spacingX; x += spacingX) {
        page.drawImage(logoImage, {
          x: x,
          y: y,
          width: logoDims.width,
          height: logoDims.height,
          opacity: 0.25,
        });
      }
    }
  }

  return await pdfDoc.save();
}

// Watermark image with tiled logo at 25% opacity
async function watermarkImage(imageBuffer, logoPath) {
  const metadata = await sharp(imageBuffer).metadata();

  // Resize logo to reasonable size (200px width)
  const logo = await sharp(logoPath)
    .resize(200)
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();

  // Create a tiled pattern by repeating the logo
  const tilesX = Math.ceil(metadata.width / (logoMeta.width * 2)) + 1;
  const tilesY = Math.ceil(metadata.height / (logoMeta.height * 2)) + 1;

  const composites = [];

  // Create tiled watermark pattern
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      composites.push({
        input: await sharp(logo)
          .ensureAlpha()
          .modulate({ brightness: 1 })
          .composite([{
            input: Buffer.from([255, 255, 255, 64]), // 25% opacity
            raw: {
              width: logoMeta.width,
              height: logoMeta.height,
              channels: 4
            },
            tile: true,
            blend: 'dest-in'
          }])
          .toBuffer(),
        top: y * logoMeta.height * 2,
        left: x * logoMeta.width * 2,
      });
    }
  }

  // Apply all watermark tiles to the image
  const watermarked = await sharp(imageBuffer)
    .composite(composites)
    .toBuffer();

  return watermarked;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const { fields, file, fileName, mimeType } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { clientName, docTitle, description } = fields;

    if (!clientName || !docTitle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Apply watermark based on file type
    let watermarkedBuffer;
    let finalMimeType = mimeType;
    let finalFileName = fileName;

    if (mimeType === 'application/pdf') {
      watermarkedBuffer = await watermarkPDF(file, LOGO_PATH);
      finalMimeType = 'application/pdf';
    } else if (mimeType.startsWith('image/')) {
      watermarkedBuffer = await watermarkImage(file, LOGO_PATH);
      finalMimeType = 'image/png'; // Convert to PNG for consistency
      finalFileName = fileName.replace(/\.[^.]+$/, '.png');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF or image.' });
    }

    // Generate unique document ID
    const docId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Upload watermarked file to Vercel Blob
    const blob = await put(`documents/${docId}/${finalFileName}`, watermarkedBuffer, {
      access: 'public',
      contentType: finalMimeType,
    });

    // Create and upload metadata
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

    // Store metadata as JSON in Blob
    await put(`documents/${docId}/metadata.json`, JSON.stringify(document), {
      access: 'public',
      contentType: 'application/json',
    });

    return res.status(200).json({
      success: true,
      document
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
}

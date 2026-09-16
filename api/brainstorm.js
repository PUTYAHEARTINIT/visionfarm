import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

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

const IdeasSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    why: z.string(),
  })).min(3).max(6),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Brainstorm isn\'t configured yet — ANTHROPIC_API_KEY is missing on this project.' });
  }

  try {
    const { clientName, docTitle, description, siteUrl } = await readBody(req);

    if (!clientName) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    const client = new Anthropic();

    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a sharp creative-and-tech agency strategist at VisionFarm, reviewing a pitch website VisionFarm just built for a prospective client.

Client: ${clientName}
Pitch title: ${docTitle || '(untitled)'}
Description: ${description || '(none given)'}
Live site: ${siteUrl || '(not given)'}

Based on what kind of business this is, suggest 4-6 SPECIFIC expansion services VisionFarm could pitch alongside the website — not a generic agency menu. Each idea should be something this exact type of business would plausibly need next, phrased as a short service name (3-6 words) plus one concrete sentence on why it fits this specific client. Avoid vague ideas like "marketing services" — be as concrete as the client's actual business.`,
      }],
      output_config: {
        format: zodOutputFormat(IdeasSchema),
      },
    });

    if (!response.parsed_output) {
      return res.status(502).json({ error: 'Could not parse a suggestion list from the model' });
    }

    return res.status(200).json({ success: true, ideas: response.parsed_output.ideas });
  } catch (error) {
    console.error('Brainstorm error:', error);
    return res.status(500).json({ error: 'Brainstorm failed', message: error.message });
  }
}

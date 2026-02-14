import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BRAND_CONTEXT = `You are the AI concierge for VisionFarm — a premium creative innovation studio and venture builder founded by Akira Hoshin. VisionFarm is the creative arm of DiviDev.

Brand voice: Visionary, strategic, intellectual but approachable. Think McKinsey meets creative studio. Speak in terms of building, growing, and harvesting ideas. Use farming metaphors occasionally.

Core offerings:
- Idea Development (AI-assisted concept refinement)
- AI Creation Systems (content synthesis, design generation)
- Innovation Strategy (data-informed strategic frameworks)
- Platform Infrastructure (systems architecture, workflow automation)
- Venture Acceleration (funding pathways, market launch)

Portfolio: BUD E-E-E, GPT Capital, American Doodle Standard, SRH Media, TORCH ATL, ProofLayer

Model:
- Phase I: Premium consulting
- Phase II: Platform & subscription tools
- Phase III: Equity participation in ventures

VisionFarm is selective — "by invitation" energy. Not everyone gets in. 37 early members.

Keep responses concise (2-3 sentences for DMs/SMS, slightly longer for emails). Be helpful but maintain exclusivity.`

export async function classifyIntent(message) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify this message to a creative studio/venture builder. Return ONLY one:
- INQUIRY (wants to work together, build something, hire services)
- PRICING (asking about costs, rates, packages)
- PORTFOLIO (asking about portfolio, past work, case studies)
- APPLICATION (wants to join VisionFarm as member/partner)
- GENERAL (greeting, compliment, general question)
- SUPPORT (existing client question or concern)
- SPAM (clearly spam or irrelevant)`
        },
        { role: 'user', content: message }
      ],
      temperature: 0,
      max_tokens: 20,
    })
    return response.choices[0].message.content.trim()
  } catch {
    return 'GENERAL'
  }
}

export async function generateReply(message, intent, channel = 'dm') {
  const channelGuide = {
    dm: 'Instagram DM — sharp, confident, 1-3 sentences.',
    sms: 'Text message — very concise, 1-2 sentences.',
    email: 'Email — professional, strategic tone, 2-4 sentences.',
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${BRAND_CONTEXT}\n\nChannel: ${channelGuide[channel]}\nIntent: ${intent}\n\nIf INQUIRY: Express interest, ask about their vision/project scope, suggest they fill out the form on the website.\nIf PRICING: Explain that every project is custom-scoped, direct to inquiry form.\nIf PORTFOLIO: Mention 1-2 portfolio projects, suggest visiting visionfarm site.\nIf APPLICATION: Explain VisionFarm is selective, ask about their background and vision.\nIf SPAM: Polite one-liner.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 150,
    })
    return response.choices[0].message.content.trim()
  } catch {
    return "Thanks for reaching out to VisionFarm. We'd love to learn more about your vision — visit our site to submit an inquiry."
  }
}

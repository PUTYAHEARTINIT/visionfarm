import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Resend } from 'resend'
import twilio from 'twilio'

import {
  insertInquiry, insertSubscriber, getAllSubscribers,
  logEmail, logSms, logIgMessage,
  enqueueDrip, getPendingDrips, markDripSent, getStats,
} from './db.js'
import { classifyIntent, generateReply } from './ai.js'
import { templates } from './email-templates.js'

const app = express()
const PORT = process.env.PORT || 3002

app.use(helmet())
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
app.use('/api/', limiter)

// ─── Service Clients ───
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'VisionFarm <onboarding@resend.dev>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sweetheartsatl.agency@gmail.com'

async function sendEmail(to, subject, html) {
  const resend = getResend()
  if (!resend) {
    console.log(`[EMAIL-MOCK] To: ${to} | Subject: ${subject}`)
    return { id: 'mock-' + Date.now() }
  }
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html })
}

async function sendSms(to, body) {
  const client = getTwilioClient()
  if (!client) {
    console.log(`[SMS-MOCK] To: ${to} | Body: ${body}`)
    return { sid: 'mock-' + Date.now() }
  }
  return client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to })
}

// ─── Health ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'alive', brand: 'VisionFarm',
    services: {
      email: !!process.env.RESEND_API_KEY,
      sms: !!process.env.TWILIO_ACCOUNT_SID,
      ai: !!process.env.OPENAI_API_KEY,
      instagram: !!process.env.META_PAGE_ACCESS_TOKEN,
    },
    ...getStats(),
  })
})

// ════════════════════════════════════════
// INQUIRY FORM
// ════════════════════════════════════════

app.post('/api/inquiry', async (req, res) => {
  try {
    const { name, email, company, projectType, budget, message } = req.body

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' })
    }

    // Save inquiry
    insertInquiry.run({
      name, email: email.toLowerCase().trim(),
      company: company || null,
      project_type: projectType || null,
      budget: budget || null,
      message: message || null,
    })

    // Also add as subscriber
    insertSubscriber.run({ email: email.toLowerCase().trim(), name, source: 'inquiry' })

    // Send confirmation to prospect
    const tmpl = templates.inquiry_received({ name, projectType })
    await sendEmail(email, tmpl.subject, tmpl.html)
    logEmail.run({ recipient: email, template: 'inquiry_received', subject: tmpl.subject, status: 'sent' })

    // Notify admin
    await sendEmail(
      ADMIN_EMAIL,
      `New VisionFarm Inquiry: ${name}${company ? ` (${company})` : ''}`,
      `<div style="font-family:sans-serif;padding:20px;">
        <h2>New Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        ${projectType ? `<p><strong>Project:</strong> ${projectType}</p>` : ''}
        ${budget ? `<p><strong>Budget:</strong> ${budget}</p>` : ''}
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      </div>`
    )

    // Queue drip
    const now = new Date()
    enqueueDrip.run({ email, name, template: 'vision_story', send_at: new Date(now.getTime() + 3 * 86400000).toISOString() })
    enqueueDrip.run({ email, name, template: 'portfolio_spotlight', send_at: new Date(now.getTime() + 7 * 86400000).toISOString() })

    console.log(`[INQUIRY] ${name} (${email}) — ${projectType || 'general'}`)
    res.json({ success: true, message: 'Inquiry received. We\'ll be in touch within 24 hours.' })
  } catch (error) {
    console.error('[INQUIRY ERROR]', error)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// ════════════════════════════════════════
// NEWSLETTER SUBSCRIBE
// ════════════════════════════════════════

app.post('/api/subscribe', async (req, res) => {
  try {
    const { email, name } = req.body
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }

    insertSubscriber.run({ email: email.toLowerCase().trim(), name: name || null, source: 'newsletter' })

    const welcome = templates.welcome(name)
    await sendEmail(email, welcome.subject, welcome.html)
    logEmail.run({ recipient: email, template: 'welcome', subject: welcome.subject, status: 'sent' })

    const now = new Date()
    enqueueDrip.run({ email, name, template: 'vision_story', send_at: new Date(now.getTime() + 3 * 86400000).toISOString() })
    enqueueDrip.run({ email, name, template: 'portfolio_spotlight', send_at: new Date(now.getTime() + 7 * 86400000).toISOString() })

    res.json({ success: true, message: 'Welcome to VisionFarm.' })
  } catch (error) {
    console.error('[SUBSCRIBE ERROR]', error)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// ════════════════════════════════════════
// SMS WEBHOOK
// ════════════════════════════════════════

app.post('/api/sms/webhook', async (req, res) => {
  try {
    const { From: from, Body: body } = req.body
    console.log(`[SMS IN] From: ${from} | Body: ${body}`)
    logSms.run({ phone: from, direction: 'inbound', body })

    if (body?.trim().toUpperCase() === 'STOP') {
      res.type('text/xml').send('<Response><Message>Unsubscribed. Reply START to re-subscribe.</Message></Response>')
      return
    }

    const intent = await classifyIntent(body || '')
    const reply = await generateReply(body || '', intent, 'sms')
    logSms.run({ phone: from, direction: 'outbound', body: reply })
    res.type('text/xml').send(`<Response><Message>${reply}</Message></Response>`)
  } catch (error) {
    console.error('[SMS ERROR]', error)
    res.type('text/xml').send('<Response><Message>Thanks for reaching out to VisionFarm!</Message></Response>')
  }
})

// ════════════════════════════════════════
// INSTAGRAM WEBHOOK
// ════════════════════════════════════════

app.get('/api/instagram/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post('/api/instagram/webhook', async (req, res) => {
  try {
    const { entry } = req.body
    res.sendStatus(200)
    if (!entry) return

    for (const e of entry) {
      for (const event of (e.messaging || [])) {
        if (event.message?.text) {
          const senderId = event.sender.id
          const msg = event.message.text
          const intent = await classifyIntent(msg)
          const reply = await generateReply(msg, intent, 'dm')
          logIgMessage.run({ sender_id: senderId, message: msg, reply, intent })
          await sendInstagramReply(senderId, reply)
        }
      }
    }
  } catch (error) {
    console.error('[IG ERROR]', error)
  }
})

async function sendInstagramReply(recipientId, message) {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) { console.log(`[IG-MOCK] To: ${recipientId} | Reply: ${message}`); return }
  try {
    await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }),
    })
  } catch (err) { console.error('[IG SEND ERROR]', err.message) }
}

// ════════════════════════════════════════
// DRIP PROCESSOR
// ════════════════════════════════════════

async function processDripQueue() {
  const pending = getPendingDrips.all()
  for (const drip of pending) {
    try {
      const template = templates[drip.template]
      if (!template) { markDripSent.run(drip.id); continue }
      const { subject, html } = template(drip.name)
      await sendEmail(drip.email, subject, html)
      logEmail.run({ recipient: drip.email, template: drip.template, subject, status: 'sent' })
      markDripSent.run(drip.id)
      console.log(`[DRIP] Sent "${drip.template}" to ${drip.email}`)
    } catch (err) { console.error(`[DRIP ERROR]`, err.message) }
  }
}

setInterval(processDripQueue, 5 * 60 * 1000)

// ─── Admin ───
app.get('/api/stats', (req, res) => res.json(getStats()))
app.get('/api/subscribers', (req, res) => {
  const subs = getAllSubscribers.all()
  res.json({ subscribers: subs, total: subs.length })
})

// ════════════════════════════════════════
// START
// ════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   VISIONFARM AUTOMATION ENGINE           ║
║   Running on http://localhost:${PORT}        ║
║                                          ║
║   POST /api/inquiry       (contact form) ║
║   POST /api/subscribe     (newsletter)   ║
║   POST /api/sms/webhook   (Twilio)       ║
║   *    /api/instagram/webhook (Meta)     ║
║   GET  /api/stats         (dashboard)    ║
║   GET  /api/health        (status)       ║
╚══════════════════════════════════════════╝
  `)
  processDripQueue()
})

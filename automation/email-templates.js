const BRAND = {
  bg: '#0a0a0a',
  card: '#141414',
  accent: '#c8ff00',
  text: '#e0e0e0',
  muted: '#777',
  font: "'Inter', 'Helvetica Neue', sans-serif",
}

function wrapper(content) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.font};">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:11px;letter-spacing:6px;color:${BRAND.accent};text-transform:uppercase;font-weight:600;">VISIONFARM</div>
      <div style="width:30px;height:1px;background:${BRAND.accent};margin:12px auto;"></div>
    </div>
    ${content}
    <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid #222;">
      <p style="color:${BRAND.muted};font-size:11px;margin:0;">Ideas planted. Ventures harvested.</p>
      <p style="color:#444;font-size:10px;margin-top:12px;">VisionFarm — A DiviDev Company</p>
    </div>
  </div>
</body>
</html>`
}

export const templates = {
  inquiry_received: ({ name, projectType }) => ({
    subject: 'VisionFarm — Inquiry Received',
    html: wrapper(`
      <div style="background:${BRAND.card};border-radius:8px;padding:40px 32px;">
        <h1 style="color:${BRAND.text};font-size:24px;font-weight:300;margin:0 0 24px;">We See Your Vision</h1>
        <p style="color:${BRAND.text};font-size:15px;line-height:1.9;">
          ${name}, thank you for reaching out to VisionFarm${projectType ? ` about <strong>${projectType}</strong>` : ''}.
        </p>
        <p style="color:${BRAND.text};font-size:15px;line-height:1.9;">
          Our team will review your inquiry and respond within 24 hours. Every project we take on is carefully selected — we build with intention, not volume.
        </p>
        <div style="border-left:3px solid ${BRAND.accent};padding:16px 24px;margin:24px 0;">
          <p style="color:${BRAND.accent};font-size:16px;font-style:italic;margin:0;">
            "The best ventures start with a single conversation."
          </p>
        </div>
        <p style="color:${BRAND.muted};font-size:14px;">
          In the meantime, explore our portfolio to see what we've built.
        </p>
      </div>
    `)
  }),

  welcome: (name) => ({
    subject: 'Welcome to the Farm',
    html: wrapper(`
      <div style="background:${BRAND.card};border-radius:8px;padding:40px 32px;text-align:center;">
        <h1 style="color:${BRAND.text};font-size:28px;font-weight:300;margin:0 0 8px;">Welcome to VisionFarm</h1>
        <div style="width:40px;height:2px;background:${BRAND.accent};margin:16px auto;"></div>
        <p style="color:${BRAND.text};font-size:16px;line-height:1.8;margin:24px 0;">
          ${name ? `${name}, you've` : "You've"} joined a selective community of builders, creators, and visionaries.
        </p>
        <p style="color:${BRAND.muted};font-size:14px;line-height:1.6;margin:24px 0;">
          We'll keep you in the loop on new ventures, tools, and opportunities coming out of the farm.
        </p>
      </div>
    `)
  }),

  vision_story: (name) => ({
    subject: 'How We Build at VisionFarm',
    html: wrapper(`
      <div style="background:${BRAND.card};border-radius:8px;padding:40px 32px;">
        <h1 style="color:${BRAND.text};font-size:24px;font-weight:300;margin:0 0 24px;text-align:center;">How We Build</h1>
        <p style="color:${BRAND.text};font-size:15px;line-height:1.9;">
          ${name ? `${name}, at` : 'At'} VisionFarm, we don't just consult — we co-build. Every venture in our portfolio started as a conversation, evolved into a strategy, and grew into something real.
        </p>
        <p style="color:${BRAND.text};font-size:15px;line-height:1.9;">
          From AI infrastructure (AutoIntel) to cultural brands (PUTYAHEARTINIT) to talent management (SweetHearts) — we build across industries because innovation doesn't respect categories.
        </p>
        <div style="border-left:3px solid ${BRAND.accent};padding:16px 24px;margin:24px 0;">
          <p style="color:${BRAND.accent};font-size:16px;font-style:italic;margin:0;">
            "Plant the seed. Build the system. Harvest the vision."
          </p>
        </div>
        <p style="color:${BRAND.muted};font-size:14px;">
          Got an idea? We'd love to hear it.
        </p>
      </div>
    `)
  }),

  portfolio_spotlight: (name) => ({
    subject: 'Inside the VisionFarm Portfolio',
    html: wrapper(`
      <div style="background:${BRAND.card};border-radius:8px;padding:40px 32px;text-align:center;">
        <p style="color:${BRAND.accent};font-size:11px;letter-spacing:4px;text-transform:uppercase;margin:0 0 16px;">Portfolio Spotlight</p>
        <h1 style="color:${BRAND.text};font-size:28px;font-weight:300;margin:0 0 24px;">What We've Built</h1>
        <div style="text-align:left;">
          <div style="padding:16px 0;border-bottom:1px solid #222;">
            <p style="color:${BRAND.accent};font-size:13px;font-weight:600;margin:0;">AutoIntel Technologies</p>
            <p style="color:${BRAND.muted};font-size:13px;margin:4px 0 0;">Distributed AI infrastructure — turning old hardware into intelligent nodes</p>
          </div>
          <div style="padding:16px 0;border-bottom:1px solid #222;">
            <p style="color:${BRAND.accent};font-size:13px;font-weight:600;margin:0;">PUTYAHEARTINIT</p>
            <p style="color:${BRAND.muted};font-size:13px;margin:4px 0 0;">Premium streetwear brand and cultural movement</p>
          </div>
          <div style="padding:16px 0;border-bottom:1px solid #222;">
            <p style="color:${BRAND.accent};font-size:13px;font-weight:600;margin:0;">SweetHearts Agency</p>
            <p style="color:${BRAND.muted};font-size:13px;margin:4px 0 0;">Boutique talent management and booking platform</p>
          </div>
          <div style="padding:16px 0;">
            <p style="color:${BRAND.accent};font-size:13px;font-weight:600;margin:0;">GPT Capital</p>
            <p style="color:${BRAND.muted};font-size:13px;margin:4px 0 0;">AI-powered financial intelligence</p>
          </div>
        </div>
      </div>
    `)
  }),
}

export default templates

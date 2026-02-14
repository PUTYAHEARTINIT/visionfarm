#!/bin/bash
cd "$(dirname "$0")"
echo "╔══════════════════════════════════════════╗"
echo "║   VISIONFARM AUTOMATION — Starting...    ║"
echo "╚══════════════════════════════════════════╝"
[ ! -f .env ] && cp .env.example .env && echo "→ Edit .env with your API keys."
[ ! -d node_modules ] && npm install
echo "  → API on http://localhost:3002"
echo "  → n8n on http://localhost:5678"
npx concurrently --names "API,N8N" --prefix-colors "green,magenta" "node --watch server.js" "n8n start"

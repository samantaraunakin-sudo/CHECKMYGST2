# CheckMyGST — Deployment Guide

## Deploy to Render.com (Free, Always-On)

### Step 1 — Push to GitHub
1. Go to github.com → New Repository → Name: `checkmygst` → Create
2. Upload all these files to the repository

### Step 2 — Deploy on Render
1. Go to render.com → Sign up free with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your `checkmygst` GitHub repository
4. Render auto-reads `render.yaml` — settings fill in automatically
5. Click **"Create Web Service"**

### Step 3 — Add your Anthropic API Key
1. In Render dashboard → Your service → **"Environment"** tab
2. Add variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from console.anthropic.com
3. Click **"Save Changes"** — Render redeploys automatically

### Step 4 — Done
Your app will be live at: `https://checkmygst.onrender.com`

---

## Local Development

```bash
npm install
npm run dev
```
App runs at http://localhost:5000

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | From console.anthropic.com |
| `PORT` | No | Default: 5000 |
| `NODE_ENV` | No | Set to `production` on Render |

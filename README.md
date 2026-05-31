# love-keyboard-landing

Mobile-first H5 landing page for **Love Keyboard** — an AI reply coach for dating texts and DMs.

## What it does

The page positions Love Keyboard as a tone coach, not a manipulation tool. The headline ("Stuck on what to text back?") leads to three reply ideas (playful / warm / confident) shown both in the hero phone mockup and in the interactive demo section.

## Stack

- Next.js 15 (App Router)
- React 19
- Vercel Analytics
- GA4 via `@next/third-parties`-style direct script tags (placeholder ID `G-LK0PLACEHOLDER`)

## Status

- Skeleton: shipped
- Visual manifest: **pending** (`visual_manifest_pending=true`)
- App Store / waitlist URL: **placeholder** (`#`); replace `CONFIG.ctaUrl` in `src/app/LandingPageClient.tsx`
- Domain: not yet bound — recommended subdomain `lovekeyboard.wouldbetterai.com`, follow `subdomain-direction-binding-wouldbetterai.md` runbook
- GA4 measurement ID: `G-LK0PLACEHOLDER` — replace once natural-flow strategy assigns the property

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Pre-deploy checklist

1. Replace `CONFIG.ctaUrl` with the real App Store / waitlist URL
2. Replace GA4 measurement ID `G-LK0PLACEHOLDER`
3. Confirm copy with strategy owner (currently English-first, US dating-app audience)
4. Decide and bind subdomain on Vercel (recommended `lovekeyboard.wouldbetterai.com`)
5. Replace placeholder phone-mockup chat content with curated screenshots/illustrations once design owner provides assets

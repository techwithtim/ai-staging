# AIStaging

An AI virtual staging app for real estate agents, built with Claude Code and Cloudinary.
Agents create a house, upload its listing photos and then:

- **Stage** empty rooms with furniture in one of eight styles
- **Clean up** clutter they name (a TV, bar stools, boxes)
- **Turn day to dusk** (golden hour, dusk or night, with lights on)
- **Make a vertical listing video** (1080 × 1920 MP4) from the finished rooms

Every edit is saved as a new version next to the original, so nothing is ever lost.
Images, AI edits and video all run on [Cloudinary](https://cloudinary.com). The app is a local MVP: one
user, a SQLite database, no sign-in or payments yet.

This repo goes with a video. [PROMPTS.md](PROMPTS.md) has every prompt used to build it, in order, so
you can follow along step by step. [docs/PLAN.md](docs/PLAN.md) is the build plan Claude wrote before
any code.

> "AIStaging" is a working name. This project isn't affiliated with any existing virtual staging company.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Run the finished app](#2-run-the-finished-app)
3. [Cloudinary setup](#3-cloudinary-setup)
4. [Landing page images](#4-landing-page-images)
5. [Follow along with Claude Code](#5-follow-along-with-claude-code)
6. [How each feature works](#6-how-each-feature-works)
7. [What it costs](#7-what-it-costs)
8. [Project structure](#8-project-structure)
9. [Troubleshooting](#9-troubleshooting)
10. [Limits and next steps](#10-limits-and-next-steps)

---

## 1. What you need

| | Version | Notes |
|---|---|---|
| Node.js | 22 or newer | Built and tested on Node 26 |
| npm | 10 or newer | Comes with Node |
| A Cloudinary account | Free or paid | Free works for trying it; see [costs](#7-what-it-costs) |
| Cloudinary **Image Generation** add-on | Free plan | Needed for Stage and Dusk. Gives 50 credits a month free |
| Chrome or Edge | Any recent | Only for following along with the taste skill's checks |
| [Claude Code](https://claude.com/claude-code) | Latest | Only to follow along; not needed to run the app |

## 2. Run the finished app

```bash
git clone https://github.com/<your-account>/ai-staging.git
cd ai-staging
npm install
cp .env.example .env.local      # then fill it in, see step 3
npm run dev
```

Open <http://localhost:3000>. The landing page is at `/`, the app at `/houses`.

The database is a single SQLite file at `data/app.db`. It's created, migrated and seeded with one local
user the first time the server starts (`instrumentation.ts`). Delete the `data` folder to start over.

## 3. Cloudinary setup

1. Sign up at [cloudinary.com](https://cloudinary.com) (the free plan is fine to start).
2. In the Cloudinary Console open **Settings → API Keys**. Copy your **Cloud name**, **API Key** and
   **API Secret**.
3. Put them in `.env.local` (this file is git-ignored; never commit it):

   ```bash
   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud_name>
   ```

4. Turn on the **Image Generation** add-on: in the Console open the add-on's page and generate one image,
   which subscribes you to its free plan. Without it, Stage and Dusk return an error; Clean up and
   videos still work.
5. Restart `npm run dev` after any change to `.env.local`.

The API secret only ever runs on the server: uploads are signed by a Server Action and the browser
sends the file straight to Cloudinary.

## 4. Landing page images

The landing page shows real results from the app: three before/after pairs and one video, stored in
your Cloudinary account under `ai-staging/marketing/`. Until you add yours, those frames are empty.

1. In the app, stage an empty room, clean up a cluttered one, turn an exterior to dusk and make a
   video.
2. Download each before and after (the **Download** links in the editor's version list and on the
   video page).
3. Put them in one folder, named:
   `stage-before`, `stage-after`, `cleanup-before`, `cleanup-after`, `dusk-before`, `dusk-after`
   (any image format) and `listing-video.mp4`.
4. Upload them:

   ```bash
   npm run marketing:upload -- ./my-landing-files
   ```

The editor screenshot in the "three steps" section is a plain file at `public/landing/editor.webp`.
Replace it with a screenshot of your own app if you like.

## 5. Follow along with Claude Code

The app was built in one Claude Code session from 14 prompts. To rebuild it yourself:

### 5.1 Start an empty folder

```bash
mkdir ai-staging && cd ai-staging
claude
```

### 5.2 Install the two design skills

**frontend-design** (Anthropic's official plugin). In Claude Code:

```
/plugin install frontend-design@claude-plugins-official
```

**taste-skill** ([leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill), MIT licence). The
first prompt in [PROMPTS.md](PROMPTS.md) asks Claude to install it for the project, which puts it in
`.claude/skills/design-taste-frontend/`. To do it by hand instead:

```bash
git clone --depth 1 https://github.com/leonxlnx/taste-skill /tmp/taste-skill
mkdir -p .claude/skills/design-taste-frontend
cp -r /tmp/taste-skill/skills/taste-skill/. .claude/skills/design-taste-frontend/
```

The taste skill is about 39 MB and adds a Stop hook that runs its page checker while the skill is in use.
Read its `SKILL.md` before you install it. This repo doesn't include it; install your own copy.

### 5.3 Connect Cloudinary to Claude Code

Claude used Cloudinary's MCP servers during the build to test uploads, staging and transformations
before writing app code. Add the Cloudinary connectors (Asset Management, Environment Config,
Structured Metadata, Analysis) from your Claude connector settings, or install the Cloudinary plugin
and sign in through `/mcp`. The app itself doesn't need them; it calls Cloudinary's REST APIs directly.

### 5.4 Give the prompts in order

Open [PROMPTS.md](PROMPTS.md) and send each prompt as written. Each step lists what Claude built and
what to check before you send the next one. Where a prompt contained real API keys they are
redacted; use your own, in `.env.local`.

Your results will differ in detail: Claude makes its own choices each run, and AI image results vary
from one generation to the next.

## 6. How each feature works

| Feature | Cloudinary feature | Where in the code |
|---|---|---|
| Upload | Signed direct upload from the browser; the server only signs | `components/upload-panel.tsx`, `prepareUpload` / `saveUpload` in `app/actions.ts` |
| Clean up | Generative remove: `e_gen_remove:prompt_(…)` | `lib/cloudinary/cleanup.ts` |
| Stage | Image Generation API, `POST /v2/generate/<cloud>/image_to_image` | `lib/staging.ts` (styles, rooms, prompt), `lib/cloudinary/generate.ts` |
| Dusk | Same Image Generation API with a relighting prompt | `lib/dusk.ts` |
| Listing video | `e_zoompan` per photo, `fl_splice` crossfades, timed `l_text` overlays | `lib/video-recipe.ts`, `lib/cloudinary/video.ts` |
| "Virtually staged" label | `l_text` overlay on download | `labelledUrl` in `lib/cloudinary/urls.ts` |

Things learned while building it (they're also in comments in the code):

- **Clean up works best on separate objects and singular prompts.** "bar stools" removed 1 of 3 stools;
  "bar stool" with `multiple_true` removed all 3. The app turns plurals into singulars before sending.
  It's unreliable on densely furnished rooms, where it can remove or invent furniture.
- **"Remove shadows too" is off by default.** With it on, one test turned a window into a door.
- **Cloudinary caches each transformation URL,** so "Try again" changes the output quality by a point
  (`q_95`, `q_94`, …) to get a fresh generation.
- **zoompan renders vertical video at 720 × 1280 at most**; the app scales clips to 1080 × 1920.
- **Cloudinary's old slideshow API is retired**; the video is built from transformations instead.
- **Interior/exterior is marked by hand.** Automatic tagging needs the AI Vision add-on, which the
  test account didn't have.

## 7. What it costs

Measured on the test account (Cloudinary Plus plan, November 2026):

| Action | Cost | Time |
|---|---|---|
| Upload, gallery, room pages | Storage and bandwidth only | Instant |
| Clean up | 50 transformations (about 0.05 Cloudinary credits) | 10 to 20 s |
| Stage or Dusk, Draft (1K, `nano-banana-2-lite-edit`) | 5 Image Generation credits (about 5 US cents) | about 10 s |
| Stage or Dusk, Final (2K, `nano-banana-2-edit`) | 14 Image Generation credits | about 20 to 40 s |
| Listing video, 4 rooms, 12 s | Video processing only, no Image Generation credits | about 30 s |

The free Image Generation plan has 50 credits a month: about 10 drafts, or 3 finals. The app shows the
credits left (as Cloudinary reports them) and blocks a request it can't afford before sending it.

## 8. Project structure

```
app/
  page.tsx                         landing page
  layout.tsx                       root layout and font
  actions.ts                       Server Actions: houses, uploads, sorting, cleanup, staging, dusk
  video-actions.ts                 Server Actions: listing videos
  houses/
    layout.tsx                     app header
    page.tsx                       house list
    new/                           create a house
    [houseId]/page.tsx             upload panel and gallery grouped by room
    [houseId]/rooms/[room]/        one room's gallery
    [houseId]/photos/[photoId]/    photo editor: Clean up, Stage, Dusk, versions
    [houseId]/video/               listing video builder
components/                        UI (upload panel, photo editor, video builder, landing parts)
lib/
  db/                              Drizzle schema, client, queries (SQLite via libSQL)
  cloudinary/                      signing, cleanup, image generation, video, URLs
  staging.ts, dusk.ts              prompts and presets
  video-recipe.ts                  builds the video transformation
  rooms.ts, gallery.ts, format.ts  rooms, grouping, number formatting
drizzle/                           SQL migrations (applied on server start)
scripts/upload-marketing.mjs       uploads the landing page's images and video
docs/PLAN.md                       the plan written before any code
PROMPTS.md                         every prompt, in order
```

Stack: Next.js 16 (App Router, Cache Components, Server Actions), React 19, TypeScript, Tailwind CSS 4,
Drizzle ORM with libSQL (SQLite), the Cloudinary Node SDK and REST APIs.

Useful commands:

```bash
npm run dev              # start the app
npm run typecheck        # route types + TypeScript
npm run lint             # ESLint
npm run db:generate      # new migration after editing lib/db/schema.ts
```

## 9. Troubleshooting

| You see | Fix |
|---|---|
| "Cloudinary isn't connected yet" | `CLOUDINARY_URL` is missing or still has placeholders. Fill it in and restart `npm run dev`. |
| Stage or Dusk: "Image Generation credits for this month are used up" | Wait for the monthly reset, or add a paid Image Generation plan in the Cloudinary Console. |
| Stage or Dusk fails right away with an add-on or permission error | Turn on the Image Generation add-on (README step 3.4). |
| Images don't show | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` must match your cloud name. Restart after changing it. |
| Landing page frames are empty | Upload your landing files (section 4). |
| "Cloudinary is still working on…" | Long generations can pass the app's wait time. Wait a minute and press Try again. |
| A database error after pulling new code | Restart the dev server so new migrations run, or delete `data/` to start fresh. |

## 10. Limits and next steps

This is an MVP made for a video, not production software:

- One local user, no sign-in, SQLite. `docs/PLAN.md` section 10 covers moving to Postgres, adding
  auth and payments, and switching polling to Cloudinary webhooks.
- No music on videos, and no AI-generated (image-to-video) clips yet.
- Draft images are 1200 px wide; use Final for listings.
- Many listing services require disclosure of virtually staged photos. Use the labelled download.

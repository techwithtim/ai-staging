# AI virtual staging app: build plan

Status: plan only. No app code has been written yet.
Last updated: 24 Nov 2026.

## 0. What we are building

A web app for real estate agents. They upload listing photos and get back:

1. **Staging.** An empty room comes back furnished in a style they pick.
2. **Declutter.** A lived-in room comes back with the mess removed (light), or fully emptied so it can be re-staged (full).
3. **Day to dusk.** An exterior shot comes back as a twilight photo with a dusk sky and warm light in the windows.
4. **Listing video.** The agent picks staged rooms and gets a short vertical (9:16) video for Reels, TikTok and Shorts.

Cloudinary handles every image, every video and all the AI. The database is the only part that sits elsewhere.

**Scope: MVP.** It runs locally on one machine for one user, with a local SQLite database. There's no sign-in, no payments and no hosting yet. The code is set up so those can be added later without a rewrite (see section 10).

**Name and branding.** The feature set matches Virtual Staging AI, but the product needs its own name, logo and copy. Reusing theirs would pass ours off as their product. Working name until you pick one: **AIStaging**.

---

## 1. What we already know works

Tested on 24 Nov 2026 with your Cloudinary account (Plus plan):

| Test | Result |
|---|---|
| Signed upload from this computer to Cloudinary | Works (`empty-living-room-test`) |
| Staging an empty living room with one image-edit call | Works (`staged-living-room-test`). The model was `nano-banana-2-edit` (premium) at 2K. Walls, windows, trim, lights and floor were kept. |
| Cost of that single staging call | **14 of the plan's 50 image-generation units** |
| Problems seen | It ignored one placement instruction, put a real brand logo (Marshall) on a speaker, and cut off a frame at the edge |

**The biggest risk is cost, not quality.** At 14 units a render, the current plan allows about 3 stagings a month. Phase 0 exists to measure what each operation really costs before any UI is built.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript + React** | One codebase for the marketing site, the app and the API routes. Upload signing and Cloudinary calls run on the server, so the API secret never reaches the browser. Best Cloudinary SDK support (`next-cloudinary`). |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives), restyled | The design skills need full control of the look; Radix provides accessible dialogs, menus, sliders and tabs. |
| Images, video, AI | **Cloudinary**: Node SDK (`cloudinary`) on the server, `next-cloudinary` in the browser | Upload, storage, delivery, generative edits, transformations, video assembly and analysis. |
| Uploads | Signed direct uploads from the browser to Cloudinary (the same flow tested above) | Files never pass through our server; the server only signs the request. |
| Database | **SQLite** (one file, `data/app.db`) through **Drizzle ORM** and `better-sqlite3` | No server to run. Drizzle supports both SQLite and Postgres, so moving later means changing the driver and running migrations, not rewriting queries. |
| Auth | **None for the MVP.** One local user, seeded on first run. | Every table still has a `user_id` column, so adding sign-in later is additive. |
| Long jobs | Job rows in SQLite. The server starts the Cloudinary call, then the browser **polls** `/api/jobs/[id]` every 2–3 s; the server checks Cloudinary's task status when asked. | Staging takes about 20 to 40 s and video longer. Webhooks can't reach a laptop without a tunnel, so the MVP polls instead. |
| Payments | **None for the MVP.** Each job still records the Cloudinary units it used. | You'll see real costs from day one, ready to set prices later. |
| Hosting | **Local only** (`npm run dev`) | |
| Testing | Vitest (prompt builders, job state changes) and Playwright (upload → stage → download) | |
| Cost tracking | A `jobs` table holding units, latency and model per call, plus a small Usage page | With no billing yet, this is how you watch the Cloudinary quota. |

---

## 3. How each feature works in Cloudinary

### 3.1 Upload and intake
1. The browser asks `/api/upload/sign` for a signature. Uploads go to `ai-staging/{userId}/{projectId}/source`, with tags and an eager 800 px thumbnail.
2. When the upload finishes, the browser posts Cloudinary's response to `/api/photos`, which creates the `photos` row. No webhook is needed.
3. **Auto-classify** with Cloudinary AI Vision (`analyze-ai-vision-general`, asked for JSON output). It reports:
   - interior or exterior
   - room type (living, bedroom, kitchen…)
   - empty, furnished or cluttered
   - day or night
4. The editor uses that to suggest the right action: empty → Stage, cluttered → Declutter, exterior in daylight → Dusk.
5. Checks on upload: JPEG, PNG, HEIC or WebP; at most 20 MB (the plan's limit); a minimum resolution; auto-rotation.

### 3.2 Staging
- **Call:** Cloudinary image-to-image generation, with the photo as reference `[1]`.
- **Prompt:** built from a template:
  - the room type and style
  - an optional furniture list
  - a fixed **"preserve" block:** same camera angle, walls, windows, trim, lights, outlets and floor
  - a fixed **"never" block:** no logos, brand names, text or people, and nothing cut off at the edges
- **Styles at launch:** Modern, Scandinavian, Mid-century, Farmhouse, Coastal, Luxury, Industrial, Minimal. Each is a prompt fragment stored in config, so new styles need no code.
- **Two-step quality** to control cost:
  - *Preview*: 1K resolution with `preference: economy`. Cheap, used to choose a style.
  - *Final*: 2K with the quality model, only on "Use this".
- **Delivery:**
  - `e_upscale` when the output is smaller than the original
  - an optional "Virtually staged" text overlay (`l_text`), because many MLS rules require that disclosure
  - `f_auto/q_auto` for web display; full JPEG for download
- **Versioning:** every render is a new asset linked to its source photo. Nothing is overwritten.

### 3.3 Declutter
- **Light declutter** (remove selected items):
  - Uses `e_gen_remove:prompt_(…);multiple_true` as a URL transformation.
  - Your usage report bills `gen_remove` under *transformations*, not the image-generation quota, so this should be much cheaper than staging. **Phase 0 confirms this.**
  - The item list comes from AI Vision or object detection (`lvis` / `unidet`), shown as checkboxes, e.g. "boxes ✓ laundry basket ✓ sofa ✗".
- **Full declutter** (empty the room):
  - The image-edit model with a "remove all furniture and loose items, keep the room" prompt.
  - This is also the first step of **re-staging** a furnished room: empty it, then stage it.

### 3.4 Day to dusk
- **Main path:** the image-edit model with a twilight prompt. Keep the house unchanged, set a dusk sky, give the windows a warm interior glow, turn on the exterior lights, and use soft ambient light.
- **Cheaper "sky only" option:** `e_gen_background_replace` with a dusk-sky prompt and a light colour grade. Good for a quick blue-sky fix; it doesn't light the windows.
- Exterior photos may show faces or licence plates; offer `e_pixelate_faces` and a plate blur on download.

### 3.5 Vertical listing video
Two tiers:

| | **Standard** (default) | **Cinematic** (premium) |
|---|---|---|
| How | Each staged photo becomes a ~3 s clip with `e_zoompan` (a slow push-in or pan), cropped to 1080×1920 with `g_auto`. Clips are joined with `fl_splice` and transitions. | Cloudinary image-to-video (`generate-video-from-image`, 9:16, 4–8 s per room) for a real camera move, then the clips are joined the same way. |
| Cost | Transformation credits only. Predictable. | Video-generation credits per clip. Double if AI audio is on. |
| Output | Deterministic, renders in seconds to minutes | Higher wow factor, but slower; clips can warp furniture, so each clip gets a review step |

Both tiers share:
- **Title card:** `l_text` overlays for address, price, and beds, baths and area.
- **Per-room captions** ("Primary bedroom").
- **End card:** the agent's logo, name and phone, from their brand kit.
- **Music:** `l_audio` with a small library of licensed tracks.
- **Rendering:** asynchronous, as an eager transformation (`eager_async`). The app polls until the derived video exists. The final MP4 is stored as an asset and also offered as a download.

### 3.6 Cost guard rails (all features)
- Every job records the units it used, its latency and its model, so the Usage page shows exactly where the quota goes.
- Repeated requests are cached: the same photo, operation, style and seed return the existing asset.
- **Before every AI call**, the app checks Cloudinary's usage report (cached for 10 minutes). It blocks the call with a clear message if the call would go past the monthly limit, or past a daily cap you set in `.env`.

---

## 4. Data model (SQLite via Drizzle, ready for Postgres)

```
users         (id, name, brokerage, brand_logo_asset_id, phone)   ← one seeded row in the MVP
projects      (id, user_id, address, price, beds, baths, sqft, created_at)
photos        (id, project_id, source_asset_id, public_id, width, height,
               kind: interior|exterior, room_type, state: empty|furnished|cluttered,
               analysis_json)
jobs          (id, user_id, photo_id, type: stage|declutter_light|declutter_full|dusk|sky|video,
               params_json (style, prompt version, items, resolution, model),
               status: queued|running|done|failed, cloudinary_task_id,
               output_asset_id, units_estimated, units_actual, latency_ms, error)
renders       (id, photo_id, job_id, asset_id, public_id, label, is_selected)
videos        (id, project_id, job_id, render_ids (JSON), tier, music, asset_id, status)
```

- IDs are text UUIDs, timestamps are ISO strings, and lists and settings are JSON columns. All three map straight to Postgres types later.
- Every query goes through `lib/db/`, so nothing else in the app knows it's SQLite.
- Cloudinary public IDs are already namespaced by user, so adding more users later needs no asset moves.
- MVP assets are delivered as ordinary `upload` URLs. Signed, authenticated delivery comes with sign-in.

---

## 5. Screens

**Marketing site** (taste skill):
1. Home, with a before/after hero
2. Examples gallery
3. Pricing (shown as "coming soon" in the MVP)

**App** (frontend-design skill):
5. **Projects:** a grid of listings, each with a cover photo and counts
6. **Project:** a drop zone for photos plus room cards, each showing its suggested action
7. **Editor:**
   - a large before/after compare slider
   - an action panel (Stage / Declutter / Dusk)
   - a style picker with thumbnails
   - renders as a filmstrip
   - Regenerate, Use this, Download
8. **Video builder:**
   - pick and order rooms (drag)
   - title card fields
   - choose music and tier
   - phone-shaped preview
   - render
9. **Brand kit:** logo, colours, contact details for end cards and watermarks
10. **Usage:** units used this month against the Cloudinary limit, cost per job, the daily cap

**How the two design skills split the work:**
- **Taste skill → marketing pages only.** It is built for public company sites (it calls this kind "software"). It enforces strict rules, such as one section per screen, real photographs, no violet, and a finish gate run in headless Chrome. Its Stop hook runs that gate on the marketing pages (`--start http://localhost:3000/`).
- **frontend-design → the logged-in app.** The taste skill's page rules don't fit a dense tool UI.
- **One shared look:** the taste skill deals the palette and type pairing for the marketing site first, and those tokens become the Tailwind theme the app uses, so both halves look like one product.

---

## 6. Folder layout

```
AIStaging/
  app/
    (marketing)/            page.tsx, pricing/, examples/       ← taste skill
    (app)/                  projects/, projects/[id]/, editor/[photoId]/, video/[projectId]/, brand/, usage/
    api/
      upload/sign/route.ts
      photos/route.ts                    save a finished upload
      jobs/route.ts                      create a job (checks quota, builds prompt, calls Cloudinary)
      jobs/[id]/route.ts                 poll: checks Cloudinary, finishes the job, returns status
  lib/
    cloudinary/             client.ts, sign.ts, generate.ts, transforms.ts, video.ts, analyze.ts, usage.ts
    prompts/                stage.ts, declutter.ts, dusk.ts, styles.json   (versioned)
    db/                     schema.ts, client.ts, queries/   (Drizzle; the only code that touches SQLite)
    jobs.ts
  components/               CompareSlider, StylePicker, RenderStrip, PhonePreview, UploadDrop…
  drizzle/                  migrations
  data/                     app.db   (git-ignored)
  .env.local                CLOUDINARY_URL, DAILY_UNIT_CAP   (git-ignored)
  scripts/spike/            Phase 0 test scripts
  tests/                    vitest + playwright
  docs/PLAN.md
```

---

## 7. Build phases

| Phase | What gets built | Done when |
|---|---|---|
| **0. Spike** (1–2 days) | Node scripts in `scripts/spike/` that call Cloudinary's **REST/SDK API** (not the chat connector) for staging, light and full declutter, dusk, sky-only, the zoompan video and one image-to-video clip. Run each on 5 test photos. | A table of **units, credits, latency and quality** for every operation and model, and how many test runs the current plan allows each month. Prompt templates v1. **Confirmation that the generative endpoints our server needs are on your plan.** |
| **1. Foundation** | Next.js scaffold, Tailwind and shadcn, Drizzle + SQLite schema and migrations, the seeded local user, signed upload, projects and photos, auto-classification | You can create a listing, upload photos and see them classified, all stored locally |
| **2. AI engine** | The `jobs` system with polling, prompt builders, preview/final staging, light and full declutter, dusk, quota check and daily cap | Each action runs end to end; costs are logged; a failed job shows why and uses no cap |
| **3. Editor UI** (frontend-design) | Project and editor screens, compare slider, style picker, render strip, downloads, "Virtually staged" label, Usage page | You can stage a full listing without help |
| **4. Video** | Video builder, Standard tier (Cinematic is optional, see section 9), brand-kit end card, music | A 9:16 MP4 of 5 rooms with title and end cards, downloadable |
| **5. Marketing pages** (taste skill) | Home, examples, pricing-coming-soon; the taste gate passes; Playwright e2e | The gate shows `GATE: PASS` and e2e is green, all running locally |

The MVP ends after phase 5. Sign-in, a hosted database, payments and deployment are the later steps in section 10.

Each phase ends with a demo. Nothing moves on until the previous phase's "done when" is true.

---

## 8. Risks

| Risk | Plan |
|---|---|
| **Image-generation quota** (14 of 50 units per render on the current plan) | Phase 0 measures every model. Cheap previews, caching, the quota check and daily cap, and probably a higher Cloudinary tier before real users. |
| SQLite locks under concurrent writes | Not a problem for one local user. WAL mode is on; the move to Postgres (section 10) comes before multiple users. |
| The model changes the room (moves a window, changes the floor) | A strong preserve block, a seed for repeat runs, one-click regenerate, and the original always shown beside the result. Optionally an AI Vision check ("were windows or walls changed?") before showing a render. |
| Real brand logos or text in renders | A "never" block in every prompt, plus an optional logo-detection check (`analyze-google-logo-detection`). |
| MLS and fair-advertising rules | The "Virtually staged" label is on by default and the original photo is kept. Terms say renders must be disclosed. |
| The generative APIs the chat connectors use aren't on our server key or plan | Phase 0 checks this first, before any UI work. |
| Cinematic video warps furniture | Standard tier is the default; cinematic clips get a review-and-regenerate step. |
| MediaFlows (Cloudinary's workflow builder) doesn't connect right now | Not needed: the job system above does the same job in our own code. |
| Slow renders (20–40 s) | Async jobs, polling with a progress state, and the browser keeps working on other photos meanwhile. |

---

## 9. Decisions for you

1. **Name** for the product (it can't be "Virtual Staging AI").
2. **Cloudinary plan:** stay on Plus for building and testing; Phase 0 shows whether that's enough for MVP testing.
3. **Cinematic video:** in the MVP, or later.

---

## 10. After the MVP: the migration path

Nothing here is built now. The MVP is shaped so each step is additive:

| Step | What changes | Why it's small |
|---|---|---|
| Hosted database | Point Drizzle at Postgres (Supabase, Neon or similar), run the same migrations, copy rows with a one-off script | Only `lib/db/` knows the driver; the types already match |
| Sign-in | Add an auth provider and replace the seeded user with the signed-in one | Every row already has `user_id`; Cloudinary folders are already per user |
| Webhooks | Swap polling for Cloudinary `notification_url` webhooks once the app has a public URL | The job states stay the same; only who triggers "check Cloudinary" changes |
| Payments | Add credits and a payment provider on top of the `jobs` cost log | Real cost per job is already recorded |
| Hosting | Deploy to Vercel or Cloudflare | Standard Next.js; SQLite is the only local-only part, and it's gone by then |

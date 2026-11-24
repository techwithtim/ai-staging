# Prompts

Every prompt used to build this app in Claude Code, in the order they were sent. Each step says what
Claude built and what to check before sending the next prompt. Setup comes first: see
[README section 5](README.md#5-follow-along-with-claude-code).

Two messages were sent while Claude was mid-task (steps 7 and 9); they're marked. API keys in step 7
are redacted: put your own in `.env.local`, never in a prompt you'll share.

---

## Step 1: Install the taste skill

```text
add this skill for this project: https://github.com/leonxlnx/taste-skill
```

**What happens:** Claude downloads the repo to a temporary folder and reads its `SKILL.md` and
scripts before installing (the skill adds a Stop hook and runs Node and headless Chrome). It installs
to `.claude/skills/design-taste-frontend/`, the folder name the skill's own hook looks for.

**Check:** the skill shows as `design-taste-frontend` in a new session.

## Step 2: Check the tools

```text
Can you check what I have access to from the front-end design skill, the Taste skill, and then the Cloudinary MCPs that I connected? Just want to make sure they're ready to go before I start building.
```

**What happens:** Claude confirms both skills and their requirements (Node, Chrome, ffmpeg), then
makes read-only calls to each Cloudinary connector (usage report, upload presets, metadata fields).

**Check:** every Cloudinary connector you plan to use answers. Several connectors may point at the
same account; that's fine.

## Step 3: Test staging with Cloudinary

```text
Can you stage this using Cloudinary, just so we can test that this will work? I'm planning on building an AIStaging application where we have some furniture, etc.
```

Attach a photo of an empty room with this prompt.

**What happens:** Claude uploads the photo with a signed upload and runs Cloudinary's image-to-image
generation with a staging prompt.

**What we learned:** the room's walls, windows and floor were kept. One staging used 14 of the free
plan's 50 monthly Image Generation credits, and the model added a real brand logo to a speaker (fixed
later with a "no logos" rule in every prompt).

## Step 4: Plan before building

```text
I want to rebuild Virtual Staging AI, an app where real estate agents upload photos of empty rooms and get them back furnished. It should also clean up clutter, turn exterior shots into dusk shots, and make a short vertical listing video from staged rooms. Use Cloudinary for all of the images, video, and AI, and then use frontend design skill for the UI, as well as the taste skill. Plan everything out and give me a detailed plan with the tech stack before writing anything or developing this app.
```

**What happens:** Claude writes `docs/PLAN.md`: stack, how each feature maps to Cloudinary, data model,
screens, phases, risks and costs. It also suggests a name of your own, since the product you describe
already exists under another name.

## Step 5: Simplify to a local MVP

```text
Let's not use Supabase or use Stripe. I just want an MVP, so I don't have that for right now. We can just do a local database, and then we can migrate it later.
```

**What happens:** the plan switches to SQLite through Drizzle (Postgres-ready), no sign-in, no
payments, polling instead of webhooks, and gains a "migration path" section.

## Step 6: Houses, uploads and galleries

```text
Let's start with the basics. I want you to build the app so that I can upload listing photos, and I want you to mark each one as interior or exterior, or let me mark that there. Then I want to see them on a gallery page for each room. I don't want to do any AI transformations yet. I just want to be able to create a new house so I can have the different photos, and then we can start staging.
```

**What happens:** Claude scaffolds Next.js, the database, signed browser-to-Cloudinary uploads,
houses, interior/exterior marking, room labels and per-room galleries. It tries Cloudinary's image
analysis for automatic interior/exterior tagging; if your account has no AI Vision add-on (the test
account didn't), marking stays manual.

**Check:** create a house, upload photos, mark them, open a room page. You'll need your Cloudinary
credentials in `.env.local` for uploads (next step).

## Step 7: Add credentials (sent mid-task)

```text
API Secret: [REDACTED]
API Key: [REDACTED]
Cloud Name: [REDACTED]

add them for me
```

**What happens:** Claude writes them to `.env.local` (git-ignored) and restarts the dev server.

**Better:** paste them into `.env.local` yourself instead of into the chat, so the secret never
appears in a transcript. If you did share a secret, rotate it in the Cloudinary Console afterwards.

## Step 8: Clean up tool

```text
Now I want to add a cleanup tool that can take a photo and remove any clutter, maybe remove a TV, remove a bar stool, or remove something like that. Let's start with the cleanup tool, and then we'll move on to the next phase.
```

**What happens:** a photo editor page with a before/after slider; you list things to remove and
Cloudinary's generative remove takes them out. Each result is saved as a new version you can compare,
retry, delete or use in the gallery.

**What we learned:** singular prompts work far better ("bar stool", not "bar stools"), the
remove-shadows option can distort windows, and densely furnished rooms give unreliable results.

## Step 9: Stop testing (sent mid-task)

```text
stop testing this is good for now
```

## Step 10: Virtual staging

```text
Nice. Let's move on to the virtual staging feature now. Start building that.
```

**What happens:** a Stage tool in the editor: room, one of eight styles, optional notes, Draft (1K) or
Final (2K). Staging can start from a cleaned-up version. The app records the model and credits of each
generation, shows the credits left, and offers a "Virtually staged" labelled download.

**Check:** run one Draft (about 5 credits) and compare it with the slider.

## Step 11: Day to dusk

```text
This is good. Now let's move on to do something for the exterior so that we can change it from daytime to nighttime, pretty much just like a dusk mode on any of the images, so I can adjust it from daytime to nighttime.
```

**What happens:** a Dusk tool with three moods (golden hour, dusk, night), lights in the windows and
porch lights, Draft or Final. Staging and dusk share one generation runner.

## Step 12: Vertical listing video

```text
Now, what I want to move on to is the vertical listing video from the stage rooms. Can you build that feature? I don't need super long videos, but let's build it out and test it.
```

**What happens:** a video builder per house: pick and order rooms, choose framing and pace, add a title
card, room names and a closing line, and get a 1080 × 1920 MP4 stored in Cloudinary. No Image
Generation credits are used.

**Check:** videos use each photo's **gallery** version. Press "Use in gallery" on a staged or dusk
version first if you want it in the video.

## Step 13: Landing page and polish

```text
Using the AI skills that we had for this project, can you build a nice, sexy, stylish landing page and just improve the overall user interface so it looks really premium and polished? Don't spend too much time on the landing page. Just give me something relatively simple that kind of sells the value of this startup.
```

**What happens:** the app moves to `/houses` and `/` becomes a landing page built from real results
(before/after hero, the four tools, three steps beside the real editor). The app gets a new header,
card-style house list and softer corners. The taste skill's copy linter is run on the page.

**Check:** add your own landing images (README section 4).

## Step 14: Publish the repo

```text
Create a full GitHub repo with all of the prompts that I gave, a full setup guide, and all the steps people would need to follow along with, as well as all of the code for this video with any secrets redacted.
```

**What happens:** this README, this file, the secret scan, and the push.

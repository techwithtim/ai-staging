// Uploads the landing page's pictures and video to your Cloudinary account.
//
//   npm run marketing:upload -- ./my-landing-files
//
// The folder must hold these files (any image format for the photos, .mp4 for the video):
//   stage-before   stage-after      an empty room, and the same room staged
//   cleanup-before cleanup-after    a room with clutter, and the same room cleaned up
//   dusk-before    dusk-after       an exterior in daylight, and the same shot at dusk
//   listing-video.mp4               a vertical video made in the app
//
// Easiest path: make them in the app, download each version (Download buttons in the editor
// and on the video page), rename them as above, then run this script.
// Each file is stored at ai-staging/marketing/<name> and replaces any earlier upload.

import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const NAMES = [
  ["stage-before", "image"],
  ["stage-after", "image"],
  ["cleanup-before", "image"],
  ["cleanup-after", "image"],
  ["dusk-before", "image"],
  ["dusk-after", "image"],
  ["listing-video", "video"],
];

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error("Usage: npm run marketing:upload -- <folder with the landing files>");
  process.exit(1);
}
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.CLOUDINARY_URL || process.env.CLOUDINARY_URL.includes("<")) {
  console.error("Set CLOUDINARY_URL in .env.local first (see README, step 3).");
  process.exit(1);
}
cloudinary.config({ secure: true });

const files = fs.readdirSync(dir);
let missing = 0;
for (const [name, type] of NAMES) {
  const file = files.find((f) => path.parse(f).name === name);
  if (!file) {
    console.error(`missing  ${name}`);
    missing++;
    continue;
  }
  const r = await cloudinary.uploader.upload(path.join(dir, file), {
    resource_type: type,
    public_id: `ai-staging/marketing/${name}`,
    asset_folder: "ai-staging/marketing",
    tags: ["ai-staging", "marketing"],
    overwrite: true,
    invalidate: true,
  });
  console.log(`uploaded ${name} (${r.width}x${r.height})`);
}
if (missing) {
  console.error(`\n${missing} file(s) missing; the landing page shows an empty frame for each.`);
  process.exit(1);
}

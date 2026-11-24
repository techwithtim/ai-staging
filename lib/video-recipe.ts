// Builds the Cloudinary transformation for a vertical listing video. Pure string building, no I/O,
// so it can be tested on its own.
//
// How it works (tested against the account on 24 Nov 2026):
// - Each photo becomes a clip with e_zoompan (Cloudinary's Ken Burns effect). zoompan renders vertical
//   video at most 720x1280, so every clip is scaled up to 1080x1920 afterwards.
// - The first photo is the base; the others are spliced on as layers with fl_splice and a crossfade.
// - Text (title card, room names, closing card) is laid over the finished timeline with start/end offsets.

export type Framing = "fill" | "whole";
export type VideoShot = {
  publicId: string; // the photo version to use (original or an edit)
  version: number;
  caption?: string | null; // "Living room"
};
export type VideoRecipe = {
  shots: VideoShot[];
  framing: Framing;
  secondsPerShot: number;
  title?: { line1: string; line2?: string } | null;
  closing?: string | null;
};

export const VIDEO = { width: 1080, height: 1920, fps: 30, fade: 0.6, maxShots: 10 } as const;

/** Text for l_text: URL-encoded, with commas and slashes double-encoded as Cloudinary requires. */
function text(s: string) {
  return encodeURIComponent(s.replace(/\s+/g, " ").trim().slice(0, 80))
    .replace(/%2C/g, "%252C")
    .replace(/%2F/g, "%252F");
}

const fmt = (n: number) => Number(n.toFixed(2)).toString();

// Alternate the camera move so consecutive rooms don't feel identical.
function move(i: number, du: number) {
  const moves = [
    `from_(zoom_1);to_(zoom_1.15)`, // push in
    `from_(zoom_1.15);to_(zoom_1)`, // pull out
    `from_(zoom_1.12;x_0.4);to_(zoom_1.12;x_0.6)`, // drift right
    `from_(zoom_1.12;x_0.6);to_(zoom_1.12;x_0.4)`, // drift left
  ];
  return `e_zoompan:du_${fmt(du)};fps_${VIDEO.fps};${moves[i % moves.length]}`;
}

function frame(framing: Framing) {
  return framing === "whole"
    ? `b_blurred:400:15,c_pad,h_${VIDEO.height},w_${VIDEO.width}`
    : `c_fill,g_center,h_${VIDEO.height},w_${VIDEO.width}`;
}

/** The chain that turns one photo into one vertical clip. */
function clip(i: number, framing: Framing, du: number) {
  return `${frame(framing)}/${move(i, du)}/c_scale,h_${VIDEO.height},w_${VIDEO.width}`;
}

/** Start time of each shot in the finished video. */
export function timeline(recipe: Pick<VideoRecipe, "shots" | "secondsPerShot">) {
  return recipe.shots.map((_, i) => i * recipe.secondsPerShot);
}

export function totalSeconds(recipe: Pick<VideoRecipe, "shots" | "secondsPerShot">) {
  return recipe.shots.length * recipe.secondsPerShot;
}

/**
 * Returns the transformation (everything between /image/upload/ and the base public id) and the
 * base public id. Deliver as: /image/upload/<transformation>/v<version>/<basePublicId>.mp4
 */
export function buildVideo(recipe: VideoRecipe) {
  const shots = recipe.shots.slice(0, VIDEO.maxShots);
  if (!shots.length) throw new Error("A video needs at least one photo.");
  const du = recipe.secondsPerShot;
  const parts: string[] = [clip(0, recipe.framing, du)];

  shots.slice(1).forEach((s, idx) => {
    const layer = s.publicId.replace(/\//g, ":");
    parts.push(`fl_splice:transition_(name_fade;du_${VIDEO.fade}),l_${layer}`);
    parts.push(clip(idx + 1, recipe.framing, du));
    parts.push("fl_layer_apply");
  });

  const starts = timeline({ shots, secondsPerShot: du });
  const end = totalSeconds({ shots, secondsPerShot: du });
  const box = "b_rgb:00000073";

  // Room names, bottom left, for each shot that has one (not the first if a title is showing).
  shots.forEach((s, i) => {
    if (!s.caption || (i === 0 && recipe.title)) return;
    const so = fmt(starts[i] + 0.4);
    const eo = fmt(starts[i] + du - 0.3);
    parts.push(`${box},co_white,l_text:Arial_58_bold:${text(` ${s.caption} `)}`);
    parts.push(`fl_layer_apply,g_south_west,x_60,y_220,so_${so},eo_${eo}`);
  });

  // Title card over the first shot: address, then the listing details.
  if (recipe.title?.line1) {
    const eo = fmt(Math.min(du, 4) - 0.2);
    parts.push(`${box},co_white,l_text:Arial_76_bold:${text(` ${recipe.title.line1} `)}`);
    parts.push(`fl_layer_apply,g_north,y_240,so_0.3,eo_${eo}`);
    if (recipe.title.line2) {
      parts.push(`${box},co_white,l_text:Arial_50:${text(` ${recipe.title.line2} `)}`);
      parts.push(`fl_layer_apply,g_north,y_360,so_0.5,eo_${eo}`);
    }
  }

  // Closing line over the last shot.
  if (recipe.closing) {
    const so = fmt(Math.max(starts[starts.length - 1], end - Math.min(du, 2.5)));
    parts.push(`${box},co_white,l_text:Arial_64_bold:${text(` ${recipe.closing} `)}`);
    parts.push(`fl_layer_apply,g_center,so_${so},eo_${fmt(end)}`);
  }

  return { transformation: parts.join("/"), base: shots[0], seconds: totalSeconds({ shots, secondsPerShot: du }) };
}

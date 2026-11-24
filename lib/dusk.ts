import type { PhotoKind } from "./db/schema";

// Day-to-dusk ("virtual twilight"): everything the request says lives here.
// Three steps from day toward night, so the agent can pick how dark the photo goes.
export type Mood = { slug: string; label: string; detail: string; sky: string; light: string };

export const MOODS: Mood[] = [
  {
    slug: "golden",
    label: "Golden hour",
    detail: "Low warm sun, still bright",
    sky: "a clear late-afternoon golden-hour sky with soft peach and gold tones near the horizon",
    light: "warm, low-angle sunlight with long soft shadows",
  },
  {
    slug: "dusk",
    label: "Dusk",
    detail: "The classic twilight listing shot",
    sky: "a twilight sky just after sunset: deep blue overhead fading to warm orange and pink at the horizon",
    light: "soft, even ambient twilight with no harsh shadows",
  },
  {
    slug: "night",
    label: "Night",
    detail: "Dark sky, everything lit",
    sky: "a clear night sky in deep navy blue, not pure black, with a faint glow at the horizon",
    light: "dark ambient light so the home's own lights are the main light source",
  },
];

export function moodFor(slug: string) {
  return MOODS.find((m) => m.slug === slug);
}

export function buildDuskPrompt(opts: { kind: PhotoKind | null; mood: string; windowsLit: boolean; outdoorLights: boolean }) {
  const mood = moodFor(opts.mood) ?? MOODS[1];
  const exterior = opts.kind !== "interior";
  const lines = exterior
    ? [
        `Turn the daytime real estate photo in [1] into a ${mood.label.toLowerCase()} photo of the same home.`,
        `Replace the sky with ${mood.sky}. Light the scene with ${mood.light}.`,
        opts.windowsLit
          ? "Every window glows with warm, inviting interior light, as if all the lights inside are on."
          : "Keep the windows dark or lightly reflective; no lights on inside.",
        opts.outdoorLights
          ? "Turn on the existing porch lights, wall sconces, garage lights and any landscape lighting with a warm glow. Do not add light fixtures that aren't in the photo."
          : "Leave the outdoor light fixtures off.",
        "Keep the house exactly as it is: the same camera angle and framing, roofline, siding, colours, windows, doors, driveway, lawn, plants and trees. Change only the sky and the lighting.",
      ]
    : [
        `Change the time of day in the interior real estate photo in [1] to ${mood.label.toLowerCase()}.`,
        `Through the windows, show ${mood.sky}. Light the room with ${mood.light}.`,
        opts.windowsLit
          ? "Turn on the room's existing ceiling lights, lamps and pendants with a warm, inviting glow."
          : "Keep the room's lights off.",
        "Keep the room exactly as it is: the same camera angle and framing, walls, furniture, floor and fixtures. Change only the light and the view outside.",
      ];
  return [
    ...lines,
    "Never add people, cars, text, logos or brand names. Photorealistic, like a professional twilight real estate photograph, with natural exposure and no heavy filters.",
  ].join(" ");
}

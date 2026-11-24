// URL helpers usable from server and client code alike.

type Asset = { version: number; publicId: string; format: string };

/** The src to give <Image>; the Cloudinary loader adds the size and format. */
export function imageSrc(photo: Pick<Asset, "version" | "publicId">) {
  return `v${photo.version}/${photo.publicId}`;
}

/**
 * An AI-edited photo with a label such as "Virtually staged" in the bottom-left corner, as a download.
 * Many listing services require edited photos to say so. Text scales with the photo.
 */
export function labelledUrl(photo: Asset & { width: number }, text = "Virtually staged") {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const size = Math.max(18, Math.round(photo.width * 0.022));
  const margin = Math.round(size * 0.9);
  const words = encodeURIComponent(` ${text} `).replace(/[,/]/g, "");
  const label = `b_rgb:262c31cc,co_white,l_text:Arial_${size}_bold:${words}`;
  return `https://res.cloudinary.com/${cloud}/image/upload/${label}/fl_layer_apply,g_south_west,x_${margin},y_${margin}/fl_attachment/v${photo.version}/${photo.publicId}.${photo.format}`;
}

type VideoAsset = { publicId: string; version: number };

export function videoUrl(v: VideoAsset, download = false) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/video/upload/${download ? "fl_attachment/" : "q_auto/"}v${v.version}/${v.publicId}.mp4`;
}

/** A still from the first frame, for the player's poster. */
export function videoPoster(v: VideoAsset) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/video/upload/so_1,w_540/f_auto/q_auto/v${v.version}/${v.publicId}.jpg`;
}

/** The untouched original, served as a download. */
export function originalUrl(photo: Asset) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloud}/image/upload/fl_attachment/v${photo.version}/${photo.publicId}.${photo.format}`;
}

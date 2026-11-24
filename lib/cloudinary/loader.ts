"use client";

// next/image loader: every <Image src> is "v<version>/<public_id>" of a Cloudinary image.
// Cloudinary resizes on delivery; f_auto/q_auto pick the format and quality per browser.
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const q = quality ? `q_${quality}` : "q_auto";
  return `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_${width}/f_auto/${q}/${src}`;
}

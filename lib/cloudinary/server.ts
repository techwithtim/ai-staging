import "server-only";
import { v2 as cloudinary } from "cloudinary";

// Reads CLOUDINARY_URL (cloudinary://<key>:<secret>@<cloud>) from .env.local.
let configured = false;
export function assertConfigured() {
  cld();
}
function cld() {
  if (!configured) {
    if (!process.env.CLOUDINARY_URL || process.env.CLOUDINARY_URL.includes("PASTE_")) {
      throw new MissingCredentialsError();
    }
    cloudinary.config({ secure: true });
    configured = true;
  }
  return cloudinary;
}

export class MissingCredentialsError extends Error {
  constructor() {
    super(
      "Cloudinary isn't connected yet. Add your API secret to CLOUDINARY_URL in .env.local, then restart the dev server.",
    );
  }
}

export function photoPublicId(userId: string, houseId: string, photoId: string) {
  return `ai-staging/${userId}/${houseId}/${photoId}`;
}

export function editPublicId(userId: string, houseId: string, photoId: string, editId: string) {
  return `ai-staging/${userId}/${houseId}/edits/${photoId}-${editId}`;
}

/** Signed parameters for one direct browser upload. The browser posts the file straight to Cloudinary. */
export function signUpload(opts: { userId: string; houseId: string; photoId: string }) {
  const c = cld();
  const { cloud_name, api_key, api_secret } = c.config();
  const params = {
    asset_folder: `ai-staging/${opts.userId}/${opts.houseId}`,
    public_id: photoPublicId(opts.userId, opts.houseId, opts.photoId),
    tags: `ai-staging,house-${opts.houseId}`,
    timestamp: Math.round(Date.now() / 1000),
  };
  const signature = c.utils.api_sign_request(params, api_secret!);
  return { cloudName: cloud_name!, apiKey: api_key!, params, signature };
}

/** Checks that an upload result really came from Cloudinary for this public id. */
export function verifyUpload(publicId: string, version: number, signature: string) {
  // Present in the SDK at runtime but missing from its type definitions.
  const utils = cld().utils as typeof cloudinary.utils & {
    verify_api_response_signature(publicId: string, version: number, signature: string): boolean;
  };
  return utils.verify_api_response_signature(publicId, version, signature);
}

export async function destroyImages(publicIds: string[]) {
  const c = cld();
  for (let i = 0; i < publicIds.length; i += 100) {
    await c.api.delete_resources(publicIds.slice(i, i + 100), {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
  }
}

/**
 * src/modules/media/media.service.ts
 *
 * Generates Cloudinary signed-upload payloads so the admin frontend can upload
 * files directly to Cloudinary from the browser — the backend never sees or
 * proxies the file bytes, only the resulting secure_url the frontend later
 * saves onto whichever field (image/gallery custom-row field, brand.logo_light_url,
 * etc.) is being edited. Postgres only ever stores that URL string.
 *
 * Runs on Cloudflare Workers, so this uses the Web Crypto API (crypto.subtle)
 * rather than Node's `crypto` module — the SHA-1 signing algorithm Cloudinary
 * requires is fully supported by SubtleCrypto.
 */

import type { CloudinaryCredentials, SignUploadRequestBody, SignedUploadPayload } from './media.types';

const IMAGE_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

/**
 * Parses a CLOUDINARY_URL env binding of the form
 * `cloudinary://<api_key>:<api_secret>@<cloud_name>` into its parts.
 */
export function parseCloudinaryUrl(cloudinaryUrl: string): CloudinaryCredentials {
  const match = cloudinaryUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) {
    throw new Error('CLOUDINARY_URL is malformed — expected cloudinary://<api_key>:<api_secret>@<cloud_name>');
  }
  const [, apiKey, apiSecret, cloudName] = match;
  return { apiKey, apiSecret, cloudName };
}

/**
 * Cloudinary's signing rule: take every parameter that will be sent to the
 * upload API (EXCEPT file, cloud_name, resource_type and api_key), sort them
 * alphabetically by key, join as `key=value` pairs with `&`, append the
 * api_secret, then SHA-1 hash the whole string and hex-encode it.
 * https://cloudinary.com/documentation/upload_widget_api_reference#signature_generation
 */
export async function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string
): Promise<string> {
  const toSign =
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&') + apiSecret;

  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Builds the full signed-upload payload the frontend hands to Cloudinary's
 * unsigned browser upload endpoint (https://api.cloudinary.com/v1_1/<cloud_name>/image/upload).
 */
export async function generateSignedUpload(
  cloudinaryUrl: string,
  opts: Pick<SignUploadRequestBody, 'folder' | 'publicId' | 'uploadPreset'> = {}
): Promise<SignedUploadPayload> {
  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(cloudinaryUrl);
  const timestamp = Math.floor(Date.now() / 1000);

  // Only include params that were actually supplied — Cloudinary's signature
  // must be computed over exactly the params sent in the upload request.
  const paramsToSign: Record<string, string | number> = { timestamp };
  if (opts.folder) paramsToSign.folder = opts.folder;
  if (opts.publicId) paramsToSign.public_id = opts.publicId;
  if (opts.uploadPreset) paramsToSign.upload_preset = opts.uploadPreset;

  const signature = await signCloudinaryParams(paramsToSign, apiSecret);

  return {
    timestamp,
    signature,
    apiKey,
    cloudName,
    ...(opts.folder ? { folder: opts.folder } : {}),
    ...(opts.publicId ? { publicId: opts.publicId } : {}),
    ...(opts.uploadPreset ? { uploadPreset: opts.uploadPreset } : {}),
  };
}

/**
 * Best-effort client-hint check. This is NOT the real enforcement boundary —
 * the backend never receives file bytes, so a malicious client can always
 * lie about mimeType. Real enforcement is the Cloudinary upload preset's
 * "Allowed formats" setting (see README.md). This just lets the frontend fail
 * fast with a friendly error before spending a round trip to Cloudinary.
 */
export function isAllowedImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return true; // no claim made — nothing to reject client-side
  return IMAGE_MIME_ALLOWLIST.has(mimeType.toLowerCase());
}

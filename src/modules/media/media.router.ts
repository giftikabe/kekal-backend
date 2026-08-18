// src/modules/media/media.router.ts
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth';
import { ok, fail } from '../../lib/response';
import { generateSignedUpload, isAllowedImageMime } from './media.service';
import type { SignUploadRequestBody } from './media.types';
import type { AppEnv } from '../../types/env';

// FIXED: was `new Hono<{ Bindings: MediaEnv }>()` — a narrow local type that
// only declared CLOUDINARY_URL, but this router mounts requireAuth, which is
// typed MiddlewareHandler<AppEnv> and needs JWT_SECRET + Variables.admin.
// AppEnv already includes CLOUDINARY_URL (src/types/env.ts), so this is a
// strict superset — no behavior change, just correct typing.
const media = new Hono<AppEnv>();

media.post('/sign', requireAuth, async (c) => {
  const cloudinaryUrl = c.env.CLOUDINARY_URL;
  if (!cloudinaryUrl) {
    return fail(c, 'Cloudinary is not configured on this environment', 'MEDIA_NOT_CONFIGURED', 500);
  }

  let body: SignUploadRequestBody = {};
  try {
    body = (await c.req.json()) as SignUploadRequestBody;
  } catch {
    body = {};
  }

  if (body.mimeType && !isAllowedImageMime(body.mimeType)) {
    return fail(c, `mimeType "${body.mimeType}" is not an allowed image type`, 'MEDIA_MIME_NOT_ALLOWED', 400);
  }

  try {
    const payload = await generateSignedUpload(cloudinaryUrl, {
      folder: body.folder, publicId: body.publicId, uploadPreset: body.uploadPreset,
    });
    return ok(c, payload);
  } catch (err) {
    return fail(c, err instanceof Error ? err.message : 'Failed to generate upload signature', 'MEDIA_SIGN_FAILED', 500);
  }
});

export default media;
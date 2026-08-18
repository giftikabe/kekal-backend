// src/modules/media/media.types.ts
// (unchanged except MediaEnv is no longer used by the router — kept here in
// case other code imports it, but router.ts now uses AppEnv from types/env.ts)

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface SignUploadRequestBody {
  folder?: string;
  publicId?: string;
  uploadPreset?: string;
  mimeType?: string;
}

export interface SignedUploadPayload {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder?: string;
  publicId?: string;
  uploadPreset?: string;
}

/** @deprecated superseded by AppEnv in src/types/env.ts — kept for reference only. */
export interface MediaEnv {
  CLOUDINARY_URL: string;
}
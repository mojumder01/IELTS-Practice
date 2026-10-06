import { z } from 'zod';

/** One file under public/media after `npm run media`: content-hashed and served by Hosting. */
export const MediaFileSchema = z.strictObject({
  path: z.string().regex(/^\/media\/(audio|img)\/[a-z0-9-]+\.[0-9a-f]{8}\.(mp3|png|jpg|webp|svg)$/),
  kind: z.enum(['audio', 'image']),
  bytes: z.number().int().positive(),
  durationSec: z.number().positive().optional(), // audio only
});

/** content/media-manifest.json, also published to Firestore as media/manifest. */
export const MediaManifestSchema = z.strictObject({
  files: z.array(MediaFileSchema),
});

export type MediaFile = z.infer<typeof MediaFileSchema>;
export type MediaManifest = z.infer<typeof MediaManifestSchema>;

import { z } from 'zod';

/** users/{uid}: the owner's goals (SPEC section 4). */
export const ProfileSchema = z.strictObject({
  targetBand: z.number().min(1).max(9).multipleOf(0.5),
  /** ISO date, "2026-12-05"; absent until set. */
  examDate: z.iso.date().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const DEFAULT_PROFILE: Profile = { targetBand: 7 };

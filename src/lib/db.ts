import {
  collection,
  deleteDoc,
  writeBatch,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { AttemptRecord } from '../engine/session';
import { AttemptSchema } from '../schema/attempt';
import { decodeSection, encodeSection } from '../schema/firestore';
import { MediaManifestSchema, type MediaManifest } from '../schema/media';
import { z } from 'zod';
import { DEFAULT_PROFILE, ProfileSchema, type Profile } from '../schema/profile';
import { vocabIdOf, VocabWordSchema, type VocabWord } from '../schema/vocab';
import {
  SECTION_IDS,
  TestFileSchema,
  TestMetaSchema,
  type Module,
  type TestFile,
  type TestMeta,
} from '../schema/test';
import type { RemoteAttempts } from '../store/examStore';

// Every Firestore read and write goes through here, validated with Zod at the boundary.

export class NotFoundError extends Error {}

/** A live test and all of its sections. */
export async function getTest(db: Firestore, testId: string): Promise<TestFile> {
  const metaDoc = await getDoc(doc(db, 'tests', testId));
  if (!metaDoc.exists()) throw new NotFoundError(`There is no test called ${testId}.`);
  const meta = TestMetaSchema.parse(metaDoc.data());
  const snapshot = await getDocs(collection(db, 'tests', testId, 'sections'));
  const sections: TestFile['sections'] = {};
  for (const section of snapshot.docs) {
    if ((SECTION_IDS as readonly string[]).includes(section.id)) {
      sections[section.id as (typeof SECTION_IDS)[number]] = decodeSection(section.data());
    }
  }
  return { meta, sections };
}

/** Every live test's metadata, for the library and the dashboard. */
export async function listTests(db: Firestore): Promise<TestMeta[]> {
  const snapshot = await getDocs(query(collection(db, 'tests'), where('status', '==', 'live')));
  return snapshot.docs.flatMap((d) => {
    const parsed = TestMetaSchema.safeParse(d.data());
    if (!parsed.success) console.warn(`Skipping test ${d.id}: it doesn't match the schema`);
    return parsed.success ? [parsed.data] : [];
  });
}

// ---- Admin (SPEC section 8) -----------------------------------------------------------------

/** Every test, draft or live, for the admin sidebar. */
export async function listAllTests(db: Firestore): Promise<TestMeta[]> {
  const snapshot = await getDocs(collection(db, 'tests'));
  return snapshot.docs.flatMap((d) => {
    const parsed = TestMetaSchema.safeParse(d.data());
    return parsed.success ? [parsed.data] : [];
  });
}

/** media/manifest: the files deployed under public/media, for the admin pickers and checks. */
export async function getManifest(db: Firestore): Promise<MediaManifest | null> {
  const snapshot = await getDoc(doc(db, 'media', 'manifest'));
  const parsed = MediaManifestSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : null;
}

// A draft may not pass the schema yet, so each part is stored as JSON text and only its outline
// is checked here; the admin checklist reports the rest.
const DraftMetaSchema = z.looseObject({
  testId: z.string(),
  book: z.string(),
  testNumber: z.number(),
  track: z.enum(['academic', 'general']),
});
const DraftSectionSchema = z.looseObject({
  kind: z.enum(['reading', 'listening', 'writing', 'speaking']),
});
const JsonDoc = z.strictObject({ json: z.string() });

function parseJson<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const docData = JsonDoc.safeParse(data);
  if (!docData.success) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(docData.data.json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** drafts/{testId} and drafts/{testId}/sections/{sectionId}: work in progress in the admin. */
export function firestoreDrafts(db: Firestore) {
  return {
    list: async (): Promise<Pick<TestMeta, 'testId' | 'book' | 'testNumber' | 'track'>[]> => {
      const snapshot = await getDocs(collection(db, 'drafts'));
      return snapshot.docs.flatMap((d) => {
        const meta = parseJson(DraftMetaSchema, d.data());
        return meta ? [meta] : [];
      });
    },
    get: async (testId: string): Promise<TestFile | null> => {
      const metaDoc = await getDoc(doc(db, 'drafts', testId));
      const meta = metaDoc.exists() ? parseJson(DraftMetaSchema, metaDoc.data()) : null;
      if (!meta) return null;
      const snapshot = await getDocs(collection(db, 'drafts', testId, 'sections'));
      const sections: Record<string, unknown> = {};
      for (const d of snapshot.docs) {
        const section = parseJson(DraftSectionSchema, d.data());
        if (section && (SECTION_IDS as readonly string[]).includes(d.id)) sections[d.id] = section;
      }
      return { meta, sections } as unknown as TestFile;
    },
    /** Writes the draft in one batch, removing sections it no longer has. */
    save: async (draft: TestFile): Promise<void> => {
      const id = draft.meta.testId;
      const existing = await getDocs(collection(db, 'drafts', id, 'sections'));
      const batch = writeBatch(db);
      batch.set(doc(db, 'drafts', id), { json: JSON.stringify(draft.meta) });
      for (const d of existing.docs) {
        if (!(d.id in draft.sections)) batch.delete(d.ref);
      }
      for (const [sectionId, section] of Object.entries(draft.sections)) {
        batch.set(doc(db, 'drafts', id, 'sections', sectionId), { json: JSON.stringify(section) });
      }
      await batch.commit();
    },
  };
}

export type DraftStore = ReturnType<typeof firestoreDrafts>;

/**
 * Publish: tests/{testId} goes live with its sections, in one batched write. The caller has
 * already run the checklist; the schema runs again here at the boundary.
 */
export async function publishTest(db: Firestore, draft: TestFile): Promise<void> {
  const parsed = TestFileSchema.parse({ ...draft, meta: { ...draft.meta, status: 'live' } });
  const id = parsed.meta.testId;
  const existing = await getDocs(collection(db, 'tests', id, 'sections'));
  const batch = writeBatch(db);
  batch.set(doc(db, 'tests', id), parsed.meta);
  for (const d of existing.docs) {
    if (!(d.id in parsed.sections)) batch.delete(d.ref);
  }
  for (const [sectionId, section] of Object.entries(parsed.sections)) {
    batch.set(doc(db, 'tests', id, 'sections', sectionId), encodeSection(section));
  }
  await batch.commit();
}

/** users/{uid}: target band and exam date; the defaults until the owner sets them. */
export async function getProfile(db: Firestore, uid: string): Promise<Profile> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  const parsed = ProfileSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : DEFAULT_PROFILE;
}

export function saveProfile(db: Firestore, uid: string, profile: Profile): Promise<void> {
  return setDoc(doc(db, 'users', uid), ProfileSchema.parse(profile));
}

/** users/{uid}/vocab: the saved words, one document per word. */
export function firestoreVocab(db: Firestore, uid: string) {
  const words = collection(db, 'users', uid, 'vocab');
  return {
    list: async (): Promise<VocabWord[]> => {
      const snapshot = await getDocs(words);
      return snapshot.docs.flatMap((d) => {
        const parsed = VocabWordSchema.safeParse(d.data());
        if (!parsed.success) console.warn(`Skipping word ${d.id}: it doesn't match the schema`);
        return parsed.success ? [parsed.data] : [];
      });
    },
    save: (word: VocabWord) =>
      setDoc(doc(words, vocabIdOf(word.word)), VocabWordSchema.parse(word)),
  };
}

export type VocabStore = ReturnType<typeof firestoreVocab>;

const toTimestamp = (ms: number) => Timestamp.fromMillis(ms);

function toFirestore(a: AttemptRecord) {
  const { submittedAt, ...rest } = a;
  return {
    ...rest,
    startedAt: toTimestamp(a.startedAt),
    updatedAt: toTimestamp(a.updatedAt),
    ...(submittedAt !== undefined ? { submittedAt: toTimestamp(submittedAt) } : {}),
  };
}

function fromFirestore(data: unknown): AttemptRecord {
  const a = AttemptSchema.parse(data);
  const ms = (t: { seconds: number; nanoseconds: number }) =>
    t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6);
  const { submittedAt, ...rest } = a;
  return {
    ...rest,
    startedAt: ms(a.startedAt),
    updatedAt: ms(a.updatedAt),
    ...(submittedAt ? { submittedAt: ms(submittedAt) } : {}),
  };
}

/** users/{uid}/attempts for the signed-in owner. */
export function firestoreAttempts(db: Firestore, uid: string): RemoteAttempts {
  const attempts = collection(db, 'users', uid, 'attempts');
  return {
    findInProgress: async (testId: string, module: Module) => {
      const snapshot = await getDocs(
        query(
          attempts,
          where('testId', '==', testId),
          where('module', '==', module),
          where('status', '==', 'in_progress'),
        ),
      );
      const records = snapshot.docs.map((d) => fromFirestore(d.data()));
      return records.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    },
    save: (attempt) =>
      setDoc(doc(attempts, attempt.attemptId), AttemptSchema.parse(toFirestore(attempt))),
    remove: (attemptId) => deleteDoc(doc(attempts, attemptId)),
    list: async () => {
      const snapshot = await getDocs(attempts);
      return snapshot.docs.flatMap((d) => {
        try {
          return [fromFirestore(d.data())];
        } catch {
          console.warn(`Skipping attempt ${d.id}: it doesn't match the schema`);
          return [];
        }
      });
    },
    get: async (attemptId) => {
      const snapshot = await getDoc(doc(attempts, attemptId));
      return snapshot.exists() ? fromFirestore(snapshot.data()) : null;
    },
  };
}

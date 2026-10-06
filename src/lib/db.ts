import {
  collection,
  deleteDoc,
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
import { decodeSection } from '../schema/firestore';
import { DEFAULT_PROFILE, ProfileSchema, type Profile } from '../schema/profile';
import {
  SECTION_IDS,
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

/** users/{uid}: target band and exam date; the defaults until the owner sets them. */
export async function getProfile(db: Firestore, uid: string): Promise<Profile> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  const parsed = ProfileSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : DEFAULT_PROFILE;
}

export function saveProfile(db: Firestore, uid: string, profile: Profile): Promise<void> {
  return setDoc(doc(db, 'users', uid), ProfileSchema.parse(profile));
}

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

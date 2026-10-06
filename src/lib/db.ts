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
import { SECTION_IDS, TestMetaSchema, type Module, type TestFile } from '../schema/test';
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
  };
}

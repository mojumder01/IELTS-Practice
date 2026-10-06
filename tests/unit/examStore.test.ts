import { describe, expect, it } from 'vitest';
import { timeLeftSec } from '../../src/engine/timer';
import { localKey } from '../../src/store/examStore';
import { examWorld, sample } from './examHarness';

const openReading = async (
  world: ReturnType<typeof examWorld>,
  mode: 'single' | 'full' = 'single',
) => {
  const store = world.newStore();
  await store.getState().open({ test: sample, module: 'reading', mode, part: 1 });
  return store;
};
const left = (store: Awaited<ReturnType<typeof openReading>>, now: number) =>
  timeLeftSec(store.getState().session!.timer!, now);

describe('exam store', () => {
  it('starts a new sitting with the test’s timing and saves it on the device', async () => {
    const world = examWorld();
    const store = await openReading(world);
    const session = store.getState().session!;
    expect(session).toMatchObject({
      mode: 'single',
      part: 1,
      status: 'in_progress',
      attemptId: 'attempt-1',
    });
    expect(left(store, world.now())).toBe(20 * 60);
    expect(world.localData.has(localKey('book21-test1', 'reading'))).toBe(true);
  });

  it('saves every change on the device at once', async () => {
    const world = examWorld();
    const store = await openReading(world);
    store.getState().answer(1, 'TRUE');
    const saved = JSON.parse(world.localData.get(localKey('book21-test1', 'reading'))!) as {
      answers: object;
    };
    expect(saved.answers).toEqual({ '1': 'TRUE' });
    expect(store.getState().lastSavedAt).toBe(world.now());
  });

  it('writes to Firestore at most every 10 seconds, always with the latest state', async () => {
    const world = examWorld();
    const store = await openReading(world);
    store.getState().answer(1, 'TRUE'); // first change: written at once
    await store.getState().flush();
    expect(world.remote.save).toHaveBeenCalledTimes(1);
    world.advance(2_000);
    store.getState().answer(2, 'FALSE');
    world.advance(2_000);
    store.getState().answer(3, 'NOT GIVEN');
    await Promise.resolve();
    expect(world.remote.save).toHaveBeenCalledTimes(1);
    world.advance(6_000); // 10 s after the first write
    await store.getState().flush();
    expect(world.remote.save).toHaveBeenCalledTimes(2);
    expect(world.remote.save.mock.lastCall![0].answers).toEqual({
      '1': 'TRUE',
      '2': 'FALSE',
      '3': 'NOT GIVEN',
    });
  });

  it('writes to Firestore at once on part change and on submit', async () => {
    const world = examWorld();
    const store = await openReading(world, 'full');
    store.getState().answer(1, 'TRUE');
    store.getState().answer(2, 'TRUE'); // throttled
    store.getState().goToPart(1); // same part: nothing to do
    await Promise.resolve();
    expect(world.remote.save).toHaveBeenCalledTimes(1);
    await store.getState().submit();
    expect(world.remote.save).toHaveBeenCalledTimes(2);
    expect(world.remote.save.mock.lastCall![0].status).toBe('submitted');
    expect(world.localData.size).toBe(0); // a finished sitting leaves the device
  });

  it('restores answers, flags, notes, part, question, pause and time left after a reload', async () => {
    const world = examWorld();
    const before = await openReading(world);
    before.getState().answer(1, 'TRUE');
    before.getState().answer(6, 'envelope');
    before.getState().toggleFlag(3);
    before.getState().setNotes('B: envelope');
    before.getState().goTo(7);
    world.advance(95_000);
    before.getState().tick();
    before.getState().pause();
    const snapshot = before.getState().session!;

    // The page reloads an hour later: the clock doesn't run while it's closed.
    world.advance(60 * 60_000);
    const after = await openReading(world);
    const restored = after.getState().session!;
    expect(restored).toMatchObject({
      attemptId: snapshot.attemptId,
      answers: { '1': 'TRUE', '6': 'envelope' },
      flagged: [3],
      notes: 'B: envelope',
      part: 1,
      current: 7,
      paused: true,
    });
    expect(left(after, world.now())).toBe(20 * 60 - 95);
  });

  it('keeps the time left current on the device as the clock ticks', async () => {
    const world = examWorld();
    const before = await openReading(world);
    world.advance(42_000);
    before.getState().tick(); // no change, just time passing
    const after = await openReading(world);
    expect(left(after, world.now())).toBe(20 * 60 - 42);
  });

  it('resumes from Firestore when another device saved later', async () => {
    const world = examWorld();
    const store = await openReading(world);
    store.getState().answer(1, 'TRUE');
    await store.getState().flush();
    const record = world.remote.save.mock.lastCall![0];
    world.remoteData.set(record.attemptId, {
      ...record,
      answers: { '1': 'FALSE' },
      updatedAt: world.now() + 5_000,
    });
    world.advance(10_000);
    const elsewhere = await openReading(world);
    expect(elsewhere.getState().session!.answers).toEqual({ '1': 'FALSE' });
  });

  it('ignores device data it can’t read', async () => {
    const world = examWorld();
    world.localData.set(localKey('book21-test1', 'reading'), JSON.stringify({ answers: 'oops' }));
    const store = await openReading(world);
    expect(store.getState().session!.answers).toEqual({});
  });

  it('switching mode starts again from the top and drops the old attempt', async () => {
    const world = examWorld();
    const store = await openReading(world);
    store.getState().answer(1, 'TRUE');
    store.getState().toggleFlag(2);
    const old = store.getState().session!.attemptId;
    store.getState().switchMode('full', 1);
    await store.getState().flush();
    const fresh = store.getState().session!;
    expect(fresh).toMatchObject({ mode: 'full', part: 1, answers: {}, flagged: [], notes: '' });
    expect(fresh.attemptId).not.toBe(old);
    expect(left(store, world.now())).toBe(60 * 60);
    expect(world.remote.remove).toHaveBeenCalledWith(old);
  });

  it('auto-submits when time runs out', async () => {
    const world = examWorld();
    const store = await openReading(world);
    world.advance(20 * 60_000);
    store.getState().tick();
    await store.getState().flush();
    expect(store.getState().session!.status).toBe('submitted');
    expect(world.remote.save.mock.lastCall![0].status).toBe('submitted');
  });

  it('stops the clock while the page is hidden', async () => {
    const world = examWorld();
    const store = await openReading(world);
    world.advance(10_000);
    store.getState().setVisible(false);
    world.advance(5 * 60_000);
    expect(left(store, world.now())).toBe(20 * 60 - 10);
    store.getState().setVisible(true);
    world.advance(5_000);
    expect(left(store, world.now())).toBe(20 * 60 - 15);
  });

  it('records that answers were revealed', async () => {
    const world = examWorld();
    const store = await openReading(world);
    store.getState().toggleShown('q1');
    expect(store.getState().session!.revealUsed).toBe(true);
  });

  it('clears the current part', async () => {
    const world = examWorld();
    const store = await openReading(world);
    store.getState().answer(1, 'TRUE');
    store.getState().toggleFlag(4);
    store.getState().clearPart();
    expect(store.getState().session).toMatchObject({ answers: {}, flagged: [] });
  });
});

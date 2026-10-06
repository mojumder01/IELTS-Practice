import type { Module, TestMeta } from '../schema/test';

/**
 * A countdown that only runs while the page is open and the test isn't paused.
 * `remainingMs` is the time left when the clock last stopped; while running,
 * time left is measured from the wall clock, so a backgrounded tab doesn't drift.
 */
export interface TimerState {
  remainingMs: number;
  runningSince: number | null; // epoch ms, or null when stopped
}

export const WARNING_SEC = 5 * 60;

export function createTimer(totalSec: number): TimerState {
  return { remainingMs: totalSec * 1000, runningSince: null };
}

export function timeLeftMs(timer: TimerState, now: number): number {
  if (timer.runningSince === null) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - (now - timer.runningSince));
}

/** Whole seconds left, rounded up so the clock shows 00:01 until time is truly up. */
export function timeLeftSec(timer: TimerState, now: number): number {
  return Math.ceil(timeLeftMs(timer, now) / 1000);
}

export function startTimer(timer: TimerState, now: number): TimerState {
  return timer.runningSince === null ? { ...timer, runningSince: now } : timer;
}

export function stopTimer(timer: TimerState, now: number): TimerState {
  return timer.runningSince === null
    ? timer
    : { remainingMs: timeLeftMs(timer, now), runningSince: null };
}

export function isExpired(timer: TimerState, now: number): boolean {
  return timeLeftMs(timer, now) <= 0;
}

/** The timer pill turns red at 5:00 or less. */
export function isWarning(secondsLeft: number): boolean {
  return secondsLeft <= WARNING_SEC;
}

/** 3600 → "60:00", 65 → "01:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export type ExamMode = 'single' | 'full';

/**
 * Time allowed, in seconds, from the test's timing (SPEC section 7). `part` is the
 * Writing task in single-part mode. Speaking has no module timer.
 */
export function durationSec(
  timing: TestMeta['timing'],
  module: Module,
  mode: ExamMode,
  part: number,
): number | null {
  switch (module) {
    case 'listening':
      return (
        (mode === 'full'
          ? timing.listening.fullMockMin + timing.listening.checkMin
          : timing.listening.singlePartMin) * 60
      );
    case 'reading':
      return (mode === 'full' ? timing.reading.fullMockMin : timing.reading.singlePartMin) * 60;
    case 'writing':
      if (mode === 'full') return timing.writing.fullMockMin * 60;
      return (part === 2 ? timing.writing.task2Min : timing.writing.task1Min) * 60;
    case 'speaking':
      return null;
  }
}

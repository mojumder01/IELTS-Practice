import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom doesn't lay pages out, so it has no scrollIntoView.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView = () => {};

// jsdom doesn't play media: play and pause just fire their events.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  };
}

afterEach(() => {
  cleanup();
});

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React Router crée des Request avec un AbortSignal de jsdom, que le Request de Node refuse. Propre aux tests.
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init: RequestInit = {}) {
    const { signal: _signal, ...rest } = init;
    super(input, rest);
  }
} as typeof Request;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

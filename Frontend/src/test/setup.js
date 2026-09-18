import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// This project imports describe/it/expect explicitly rather than relying on
// vitest's `globals: true`, so React Testing Library's auto-cleanup (which
// depends on detecting a global afterEach) doesn't kick in on its own.
afterEach(() => {
  cleanup();
});

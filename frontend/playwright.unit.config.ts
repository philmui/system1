import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['events.spec.ts', 'timing.spec.ts', 'workflow.spec.ts', 'execution-layout.spec.ts', 'replay.spec.ts'],
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['api-client.spec.ts', 'api-proxy.spec.ts', 'events.spec.ts', 'timing.spec.ts', 'workflow.spec.ts', 'execution-layout.spec.ts', 'replay.spec.ts', 'learning.spec.ts', 'batch-comparison.spec.ts', 'experiment.spec.ts', 'publication-graph.spec.ts', 'lesson-timing.spec.ts', 'lesson-flow.spec.ts', 'live-review.spec.ts', 'live-lessons.spec.ts', 'performance-report.spec.ts', 'discovery-performance.spec.ts', 'discovery-lesson-graph.spec.ts', 'discovery-journey.spec.ts', 'discovery-tree.spec.ts', 'discovery-playback.spec.ts', 'measured-lesson-flow.spec.ts', 'frontier-models.spec.ts'],
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
});

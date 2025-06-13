import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60 seconds for integration tests with containers
    hookTimeout: 60000, // 60 seconds for setup/teardown hooks
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'vitest.config.ts',
      ],
    },
    // Run integration tests in sequence to avoid container conflicts
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

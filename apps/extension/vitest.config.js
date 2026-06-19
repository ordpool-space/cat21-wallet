import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: 'src/**/*.spec.{ts,tsx}',
    globals: true,
    environment: 'node',
    setupFiles: './tests/unit/unit-test.setup.js',
    deps: { interopDefault: true },
    silent: false,
    coverage: {
      provider: 'v8',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/scripts/**',
        '**/*.spec.{ts,tsx}',
        '**/tests/**',
        '**/*.config.{js,ts}',
      ],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve('./src/shared'),
      '@background': path.resolve('./src/background'),
      '@content-scripts': path.resolve('./src/content-scripts'),
      '@inpage': path.resolve('./src/inpage'),
      '@app': path.resolve('./src/app'),
      '@tests': path.resolve('./tests'),
    },
    // Force a single React copy across the dep graph. Without this,
    // pnpm's per-package resolution gives RTL's react-dom one React
    // and the hook-under-test a different one, and useRef bombs with
    // "Cannot read properties of null". Pin both packages so any
    // jsdom-environment spec uses the same react that RTL was
    // resolved against.
    dedupe: ['react', 'react-dom'],
  },
});

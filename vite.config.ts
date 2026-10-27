import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages sirve el sitio de proyecto en https://josepcru.github.io/LearningBasics/
export default defineConfig({
  base: '/LearningBasics/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});

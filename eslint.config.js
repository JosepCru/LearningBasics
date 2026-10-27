import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Capas permitidas: ver docs/ARCHITECTURE.md § Reglas de dependencia.
const forbidOutsideCore = ['**/data/**', '**/sync/**', '**/features/**', '**/ui/**', '**/app/**'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/generated'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // core/ es dominio puro: sin React, sin E/S, sin capas superiores.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'react-router', 'dexie'],
          patterns: [...forbidOutsideCore, '@supabase/*'],
        },
      ],
    },
  },
  {
    // scripts/ solo puede apoyarse en core/.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidOutsideCore }],
    },
  },
);

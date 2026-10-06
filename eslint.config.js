import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// CLAUDE.md: colours come from tokens only, never hex values in components.
const hexColour = '/#[0-9a-fA-F]{3,8}\\b/';
const useTokens = 'Use a colour token from src/styles/tokens.css instead of a hex value.';

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-e2e',
    'coverage',
    'playwright-report',
    'test-results',
    'docs/design',
  ]),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/unit/**/*.{ts,tsx}', 'tests/setup.ts'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${hexColour}]`, message: useTokens },
        { selector: `TemplateElement[value.raw=${hexColour}]`, message: useTokens },
      ],
    },
  },
  prettier,
]);

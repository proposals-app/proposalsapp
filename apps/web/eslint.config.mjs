import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': ['error', { ignore: ['tw'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/purity': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Stories files - allow hooks in render functions
  {
    files: ['**/*.stories.{js,jsx,ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  // E2E test files - relaxed rules
  {
    files: ['e2e/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Config files - allow CommonJS
  {
    files: ['**/*.config.{js,mjs,cjs}', '**/*.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.storybook/**',
      'postcss.config.cjs',
      '.cache-synpress/**',
      '**/cache-synpress/**',
      '**/metamask-chrome-*/**',
      'storybook-static/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/sw.js',
      '**/sw.*.js',
    ],
  }
);

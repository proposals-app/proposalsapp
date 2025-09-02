// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

// @ts-check
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
  // Global ignores - must be first
  {
    ignores: [
      // Dependencies
      'node_modules/',
      '**/node_modules/',
      
      // Build outputs
      'dist/',
      '**/dist/',
      'build/',
      '**/build/',
      '.next/',
      '**/.next/',
      'out/',
      '**/out/',
      
      // Build tools
      '.turbo/',
      '**/.turbo/',
      
      // Cache directories
      '.cache/',
      '.cache-*/',
      '**/.cache/',
      '**/.cache-*/',
      '.cache-synpress/',
      '**/.cache-synpress/',
      '**/cache-synpress/**',
      '**/metamask-chrome-*/**',
      '.eslintcache',
      
      // Test outputs
      'coverage/',
      '**/coverage/',
      'playwright-report/',
      '**/playwright-report/',
      'test-results/',
      '**/test-results/',
      
      // Minified/bundled files
      '**/*.min.js',
      '**/*.bundle.js',
      '**/*-bundle.js',
      '**/*.production.js',
      
      // Specific library that should not be linted
      'libs/ts/visual-dom-diff/**',
      
      // Email library build
      'libs/ts/emails/.react-email/',
      'libs/ts/emails/dist/',
      
      // Observability stack
      'apps/observe/',
      
      // Generated files
      '**/*.generated.*',
      '**/*.d.ts',
      '**/*.d.mts',
      
      // Rust/Cargo
      '.cargo/',
      'target/',
      '**/target/',
      
      // Editor/IDE
      '.claude/',
      '**/.claude/',
      '.idea/',
      '.vscode/',
      '*.swp',
      '*.swo',
      
      // Service worker
      '**/sw.js',
      '**/sw.*.js',
      
      // Storybook
      'storybook-static/',
      '**/storybook-static/',
    ],
  }, // Base JavaScript configuration
  js.configs.recommended, // Default environment for all files with proper globals
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        // React global types
        React: 'readonly',
        JSX: 'readonly',
      },
    },
  }, // TypeScript configuration with recommended rules
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript recommended rules (manually defined)
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
    },
  }, // Disable no-undef for TypeScript files (TypeScript handles this better)
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-undef': 'off', // TypeScript's compiler already handles undefined variables
    },
  }, // Additional rules for all TypeScript and JavaScript files
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      // General JavaScript/TypeScript rules
      'no-console': 'off',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
      'no-unused-expressions': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-var': 'error',

      // Import organization (disabled for now to avoid conflicts with prettier-plugin-organize-imports)
      'sort-imports': 'off',

      // Prettier integration
      'prettier/prettier': 'error',
    },
  }, // React-specific rules for web app (commented out until react plugin is properly configured)
  // {
  //   files: ['apps/web/**/*.{jsx,tsx}'],
  //   rules: {
  //     'react/jsx-boolean-value': ['error', 'never'],
  //     'react/jsx-curly-brace-presence': [
  //       'error',
  //       { props: 'never', children: 'never' },
  //     ],
  //     'react/jsx-fragments': ['error', 'syntax'],
  //     'react/jsx-no-useless-fragment': 'error',
  //     'react/jsx-pascal-case': 'error',
  //     'react/jsx-sort-props': [
  //       'error',
  //       {
  //         callbacksLast: true,
  //         shorthandFirst: true,
  //         multiline: 'last',
  //         reservedFirst: true,
  //       },
  //     ],
  //     'react/no-array-index-key': 'warn',
  //     'react/no-unstable-nested-components': 'error',
  //     'react/self-closing-comp': 'error',
  //   },
  // },

  // Configuration files
  {
    files: ['**/*.config.{js,mjs,ts}', '**/config/**/*.{js,mjs,ts}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-undef': 'off',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  }, // Test files
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}', '**/__tests__/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  }, // Storybook configuration files
  {
    files: ['**/.storybook/**/*.{js,jsx,ts,tsx}', '**/*.stories.{js,jsx,ts,tsx}'],
    rules: {
      'no-undef': 'off', // Storybook has its own globals
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }, // Prettier configuration (must be last)
  prettier,
  ...storybook.configs['flat/recommended'],
];

// @ts-check
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // Global ignores - must be first
  {
    ignores: [
      'node_modules/',
      'dist/',
      '**/dist/',
      'build/',
      '**/build/',
      '.next/',
      '**/.next/',
      '.turbo/',
      '**/.turbo/',
      '.cache/',
      '.cache-*/',
      '**/.cache/',
      '**/.cache-*/',
      '.cache-synpress/',
      '**/.cache-synpress/',
      '**/cache-synpress/**',
      '**/metamask-chrome-*/**',
      'coverage/',
      'playwright-report/',
      '**/playwright-report/',
      'test-results/',
      '*.min.js',
      '*.bundle.js',
      'libs/ts/visual-dom-diff/',
      'libs/ts/emails/.react-email/',
      'libs/ts/emails/dist/',
      'apps/observe/',
      '**/*.generated.*',
      '**/*.d.ts',
      '.cargo/',
      'target/',
      '.claude/',
      '**/.claude/',
      '**/sw.js',
    ],
  },

  // Base JavaScript configuration
  js.configs.recommended,

  // Default environment for all files
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
  },

  // TypeScript configuration with recommended rules
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
  },

  // Additional rules for all TypeScript and JavaScript files
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
  },

  // React-specific rules for web app (commented out until react plugin is properly configured)
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
  },

  // Test files
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}', '**/__tests__/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Next.js web app configuration
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx,mjs}'],
    languageOptions: {
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLFormElement: 'readonly',
        Element: 'readonly',
        Document: 'readonly',
        Text: 'readonly',
        Comment: 'readonly',
        DocumentFragment: 'readonly',
        DocumentType: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        CustomEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        Storage: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        // React
        React: 'readonly',
        JSX: 'readonly',
        // Additional browser APIs
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        Node: 'readonly',
        crypto: 'readonly',
        getComputedStyle: 'readonly',
        ServiceWorkerGlobalScope: 'readonly',
        ReadableStream: 'readonly',
      },
    },
    rules: {
      // Web app specific overrides if needed
    },
  },

  // Prettier configuration (must be last)
  prettier,
];

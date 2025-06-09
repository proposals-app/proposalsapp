// @ts-check

/** @type {import("prettier").Config} */
export default {
  // Base configuration
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',

  // Plugin configuration
  plugins: [
    'prettier-plugin-organize-imports',
    'prettier-plugin-tailwindcss',
    'prettier-plugin-merge',
  ],

  // Organize imports plugin options
  organizeImportsSkipDestructiveCodeActions: true,

  // Tailwind CSS plugin options
  tailwindConfig: './apps/web/tailwind.config.mjs',
  tailwindFunctions: ['clsx', 'cn', 'cva', 'tw'],

  // Override for specific file types
  overrides: [
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always',
      },
    },
    {
      files: '*.{yml,yaml}',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: '*.json',
      options: {
        tabWidth: 2,
        trailingComma: 'none',
      },
    },
    {
      files: ['package.json', 'tsconfig.json'],
      options: {
        tabWidth: 2,
        trailingComma: 'none',
        printWidth: 120,
      },
    },
    {
      files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
      options: {
        // Web app specific overrides if needed
        printWidth: 80,
      },
    },
    {
      files: ['libs/ts/emails/**/*.{js,jsx,ts,tsx}'],
      options: {
        // Emails specific Tailwind config
        tailwindConfig: './libs/ts/emails/tailwind.config.ts',
        tailwindFunctions: ['cn'],
      },
    },
  ],
};

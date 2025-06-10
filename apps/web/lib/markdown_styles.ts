export const MARKDOWN_STYLES = {
  // Headings with better typography and spacing
  h1: 'mb-6 mt-8 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 md:text-3xl lg:text-4xl',
  h2: 'mb-5 mt-8 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 md:text-2xl lg:text-3xl',
  h3: 'mb-4 mt-6 text-xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200 md:text-xl lg:text-2xl',
  h4: 'mb-3 mt-5 text-lg font-semibold tracking-tight text-neutral-800 dark:text-neutral-200 md:text-lg lg:text-xl',
  h5: 'mb-3 mt-4 text-base font-semibold tracking-tight text-neutral-700 dark:text-neutral-300 md:text-lg',
  h6: 'mb-2 mt-4 text-sm font-semibold tracking-wide uppercase text-neutral-600 dark:text-neutral-400 md:text-base',

  // Body text with improved readability
  p: 'mb-4 leading-7 text-neutral-700 dark:text-neutral-300 md:leading-8',

  // Lists with better spacing and visual hierarchy
  ul: 'mb-5 list-disc space-y-1.5 pl-6 text-neutral-700 dark:text-neutral-300 md:pl-8 md:space-y-2',
  ol: 'mb-5 list-decimal space-y-1.5 pl-6 text-neutral-700 dark:text-neutral-300 md:pl-8 md:space-y-2',
  li: 'leading-7 text-neutral-700 dark:text-neutral-300 md:leading-8',

  // Inline elements with proper emphasis
  strong: 'font-semibold text-neutral-900 dark:text-neutral-100',
  em: 'italic text-neutral-800 dark:text-neutral-200',

  // Links with subtle contrast using neutral palette
  a: 'font-medium text-neutral-600 underline decoration-neutral-400/60 underline-offset-2 transition-colors hover:text-neutral-800 hover:decoration-neutral-500/80 dark:text-neutral-400 dark:decoration-neutral-500/60 dark:hover:text-neutral-200 dark:hover:decoration-neutral-400/80',

  // Enhanced blockquotes
  blockquote:
    'my-6 border-l-4 border-neutral-300 bg-neutral-50/50 pl-6 pr-4 py-4 italic text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-300',

  // Improved code styling
  code: 'rounded-md bg-neutral-100 px-2 py-1 text-sm font-mono text-neutral-800 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700',
  pre: 'my-6 overflow-x-auto rounded-lg bg-neutral-100 p-4 text-sm font-mono text-neutral-800 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700 md:text-base',

  // Better dividers
  hr: 'my-8 border-0 border-t border-neutral-200 dark:border-neutral-700',

  // Enhanced table styling
  table:
    'my-6 min-w-full divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 text-sm dark:divide-neutral-700 dark:border-neutral-700 md:text-base',
  thead: 'bg-neutral-50 dark:bg-neutral-800',
  tbody:
    'divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-900',
  th: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 md:px-6 md:py-4',
  td: 'px-4 py-3 text-neutral-700 dark:text-neutral-300 md:px-6 md:py-4',

  // Images with better spacing
  img: 'my-6 h-auto max-w-full rounded-lg shadow-sm',

  // Enhanced keyboard keys
  kbd: 'inline-flex items-center rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-mono text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 md:text-sm',

  // Better text decorations
  del: 'line-through text-neutral-500 dark:text-neutral-500',
  ins: 'underline decoration-green-500 text-neutral-700 dark:text-neutral-300',
  mark: 'rounded bg-yellow-200 px-1 py-0.5 text-neutral-900 dark:bg-yellow-400/20 dark:text-neutral-100',
};

export const QUOTE_STYLES = {
  wrapper:
    'my-6 rounded-lg border-l-4 border-neutral-300 bg-neutral-100/50 p-5 shadow-sm dark:border-neutral-600 dark:bg-neutral-800/50',
  header:
    'mb-3 flex items-center text-sm font-semibold text-neutral-700 dark:text-neutral-300',
  content: 'text-neutral-700 dark:text-neutral-300 [&>*:last-child]:mb-0',
} as const;

export const QUOTE_STYLES_POST = {
  wrapper:
    'my-6 rounded-lg border-l-4 border-neutral-300 bg-neutral-100/50 p-5 shadow-sm dark:border-neutral-600 dark:bg-neutral-800/50',
  header:
    'mb-3 flex items-center text-sm font-semibold text-neutral-700 dark:text-neutral-300',
  content: 'text-neutral-700 dark:text-neutral-300 [&>*:last-child]:mb-0',
  linkWrapper: 'mt-4 flex w-full justify-end',
  link: 'inline-flex items-center px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-300',
} as const;

export const COLLAPSIBLE_STYLES = {
  details:
    'my-6 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900',
  summary:
    'flex cursor-pointer items-center justify-between bg-neutral-50 p-4 font-semibold text-neutral-800 transition-colors hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 [&::-webkit-details-marker]:hidden',
  content: 'p-5 text-neutral-700 dark:text-neutral-300 [&>*:last-child]:mb-0',
} as const;

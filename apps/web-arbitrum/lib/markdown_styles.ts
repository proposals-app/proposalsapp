export const MARKDOWN_STYLES = {
  h1: 'mb-4 mt-6 text-2xl font-bold text-neutral-700 dark:text-neutral-100',
  h2: 'mb-3 mt-5 text-xl font-bold text-neutral-700 dark:text-neutral-100',
  h3: 'mb-2 mt-4 text-lg font-bold text-neutral-700 dark:text-neutral-100',
  h4: 'mb-2 mt-4 font-bold text-neutral-700 dark:text-neutral-100',
  h5: 'mb-2 mt-4 text-sm font-bold text-neutral-700 dark:text-neutral-100',
  h6: 'mb-2 mt-4 text-xs font-bold text-neutral-700 dark:text-neutral-100',
  p: 'mb-4 leading-relaxed text-neutral-700 dark:text-neutral-100',
  ul: 'mb-4 list-disc space-y-2 pl-6 text-neutral-700 dark:text-neutral-100',
  ol: 'mb-4 list-decimal space-y-2 pl-6 text-neutral-700 dark:text-neutral-100',
  li: 'leading-relaxed text-neutral-700 dark:text-neutral-100',
  strong: 'font-bold text-neutral-700 dark:text-neutral-100',
  em: 'italic text-neutral-700 dark:text-neutral-100',
  a: 'underline text-neutral-700 dark:text-neutral-100 hover:text-neutral-900 dark:hover:text-neutral-300',
  blockquote: 'border-l-4 pl-4 italic text-neutral-700 dark:text-neutral-100',
  code: 'bg-neutral-100 dark:bg-neutral-800 p-1 rounded text-sm font-mono text-neutral-700 dark:text-neutral-100',
  pre: 'bg-neutral-100 dark:bg-neutral-800 p-4 rounded my-4 overflow-x-auto text-neutral-700 dark:text-neutral-100',
  hr: 'my-6 border-t border-neutral-300 dark:border-neutral-700',
  table:
    'min-w-full border-collapse border my-4 text-neutral-700 dark:text-neutral-100',
  th: 'border p-2 text-left text-neutral-700 dark:text-neutral-100',
  td: 'border p-2 text-neutral-700 dark:text-neutral-100',
  img: 'my-4 h-auto max-w-full text-neutral-700 dark:text-neutral-100',
  kbd: 'bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded text-sm font-mono text-neutral-700 dark:text-neutral-100',
  del: 'line-through text-neutral-700 dark:text-neutral-100',
  ins: 'underline text-neutral-700 dark:text-neutral-100',
  mark: 'bg-yellow-200 dark:bg-yellow-800 text-neutral-700 dark:text-neutral-100',
};

export const QUOTE_STYLES = {
  wrapper: 'my-4 border-l-2 p-4 text-neutral-700 dark:text-neutral-100',
  header: 'flex text-sm mb-2 font-bold text-neutral-700 dark:text-neutral-100',
  content: 'text-neutral-700 dark:text-neutral-100',
} as const;

export const QUOTE_STYLES_POST = {
  wrapper: 'my-4 border-l-2 p-4',
  header: 'flex text-sm mb-2 font-bold',
  content: '',
  linkWrapper: 'w-full flex justify-end mt-2 cursor-default select-none',
  link: 'hover:underline text-sm font-bold no-underline',
} as const;

export const COLLAPSIBLE_STYLES = {
  details:
    'my-4 border rounded-lg overflow-hidden text-neutral-700 dark:text-neutral-100',
  summary:
    'p-4 cursor-pointer font-bold text-neutral-700 dark:text-neutral-100',
  content: 'p-4 text-neutral-700 dark:text-neutral-100',
} as const;

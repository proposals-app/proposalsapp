// Mock for @/lib/markdown-converter to avoid jsdom dependencies in Storybook

export function markdownToHtml(markdown, context = 'body') {
  // Enhanced HTML conversion without jsdom dependency
  if (!markdown) return '<div class="text-gray-500">No content</div>';
  
  // If it's already HTML (like from discourse), just apply some basic styling
  if (markdown.includes('<p>') || markdown.includes('<div>')) {
    // Add Tailwind classes to existing HTML
    let html = markdown
      .replace(/<p([^>]*)>/g, '<p$1 class="mb-4 text-gray-900 dark:text-gray-100">')
      .replace(/<h1([^>]*)>/g, '<h1$1 class="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">')
      .replace(/<h2([^>]*)>/g, '<h2$1 class="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">')
      .replace(/<h3([^>]*)>/g, '<h3$1 class="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">')
      .replace(/<ul([^>]*)>/g, '<ul$1 class="list-disc list-inside mb-4 text-gray-900 dark:text-gray-100">')
      .replace(/<ol([^>]*)>/g, '<ol$1 class="list-decimal list-inside mb-4 text-gray-900 dark:text-gray-100">')
      .replace(/<li([^>]*)>/g, '<li$1 class="mb-1">')
      .replace(/<blockquote([^>]*)>/g, '<blockquote$1 class="border-l-4 border-gray-300 pl-4 italic mb-4 text-gray-700 dark:text-gray-300">')
      .replace(/<code([^>]*)>/g, '<code$1 class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">')
      .replace(/<pre([^>]*)>/g, '<pre$1 class="bg-gray-100 dark:bg-gray-800 p-4 rounded mb-4 overflow-x-auto">')
      .replace(/<a([^>]*)>/g, '<a$1 class="text-blue-600 dark:text-blue-400 hover:underline">');
    
    return html;
  }
  
  // Basic markdown-to-HTML conversion for plain text
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">$1</h1>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    // Code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-900 dark:text-gray-100">')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p class="mb-4 text-gray-900 dark:text-gray-100">')
    .replace(/$/, '</p>');
  
  return html;
}

export function markdownDiff(currentContent, previousContent) {
  return markdownToHtml(currentContent);
}

export function processMarkdown(visibleBodyContent, previousBodyContent, diffEnabled, currentVersion, context = 'body') {
  return markdownToHtml(visibleBodyContent, context);
}

export function diffTextWord(oldText, newText) {
  return [];
}

export default markdownToHtml;
import { describe, expect, it } from 'vitest';
import { markdownDiff, markdownToHtml } from './markdown-converter';

describe('markdown conversion safety', () => {
  it('removes executable HTML and URL protocols', () => {
    const html = markdownToHtml(
      '<img src="x" onerror="alert(1)"> [click](javascript:alert(1))'
    );

    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('escapes discourse quote metadata', () => {
    const html = markdownToHtml(
      '[quote="<img src=x onerror=alert(1)>"]safe[/quote]'
    );

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('onerror');
    expect(html).toContain('safe');
  });

  it('does not reintroduce executable markup in diffs', () => {
    const html = markdownDiff(
      '<img src="x" onerror="alert(1)"> [click](javascript:alert(1))',
      'safe'
    );

    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });
});

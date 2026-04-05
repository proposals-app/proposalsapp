import { describe, expect, it } from 'vitest';

import { textToolResponse } from './tool-response';

describe('textToolResponse', () => {
  it('returns compact single-line JSON while preserving content', () => {
    const response = textToolResponse({
      ok: true,
      rows: [
        {
          id: 'row-1',
          body: 'line 1\nline 2',
        },
      ],
    });

    const text = response.content[0]?.text ?? '';

    expect(text).toBe(
      '{"ok":true,"rows":[{"id":"row-1","body":"line 1\\nline 2"}]}'
    );
    expect(text).not.toContain('\n');
    expect(JSON.parse(text)).toEqual({
      ok: true,
      rows: [
        {
          id: 'row-1',
          body: 'line 1\nline 2',
        },
      ],
    });
  });
});

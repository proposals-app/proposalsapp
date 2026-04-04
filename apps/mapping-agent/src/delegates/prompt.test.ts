import { describe, expect, it } from 'vitest';

import { buildDelegateSystemPrompt } from './prompt';

describe('buildDelegateSystemPrompt', () => {
  it('requires corroboration for common-name matches and allows only rare near-exact exceptions', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'for common-name or generic-handle cases, require at least one non-name corroborator before accepting'
    );
    expect(prompt).toContain(
      'if the strongest link is only a common name or a generic handle, decline'
    );
    expect(prompt).toContain(
      'exceptionally distinctive name matches may be accepted on name similarity alone'
    );
  });

  it('warns that mentions and prominence are not identity proof', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'voting power, posting volume, activity level, or being the most prominent candidate in the DAO are not identity proof by themselves'
    );
    expect(prompt).toContain('if a vote reason merely mentions another person');
    expect(prompt).toContain(
      'that is evidence about the referenced person being discussed, not proof that the voter is that person'
    );
  });
});

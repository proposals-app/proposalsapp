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

  it('teaches the agent to use delegate communication threads and rejects substring ENS jumps', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'The query tool can also read the backing public tables shown in the schema export'
    );
    expect(prompt).toContain(
      'a self-authored delegate communication thread, delegate statement, or voting-rationale thread that explicitly lists a wallet address, ENS, forum username, or social handle is strong direct proof'
    );
    expect(prompt).toContain(
      'do not accept a candidate just because the delegate handle appears as a substring inside a longer ENS, address label, or display name'
    );
    expect(prompt).toContain(
      'query raw discourse_topic and discourse_post directly to inspect thread titles and cooked post content for self-identification evidence'
    );
  });

  it('treats retirement as status context rather than a reason to decline a proven identity', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'identity mapping is about whether the discourse-side person and the voter-side person are the same actor'
    );
    expect(prompt).toContain(
      'do not decline just because the person later retired, stopped voting, asked for undelegation, or said they are no longer an active delegate'
    );
    expect(prompt).toContain(
      'if those statements help prove the same identity, use them as corroborating evidence and still map the identity when the wallet link is strong enough'
    );
  });
});

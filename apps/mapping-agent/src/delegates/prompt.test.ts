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

  it('teaches the agent to inspect self-started communication threads before fuzzy matching', () => {
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
      'discourse_topic does not encode the topic author directly; to find topics started by the discourse user, inspect raw discourse_post rows where post_number = 1 and user_id matches the discourse user external_id'
    );
    expect(prompt).toContain(
      'review the titles of those self-started topics first; if a title looks relevant, such as a delegate communication thread, presentation thread, introduction, statement, rationale thread, or equivalent self-authored identity topic, then read that thread before relying on looser evidence'
    );
    expect(prompt).toContain(
      'do not jump to a fuzzy ENS or handle match until you have checked the discourse user own-topic titles for direct self-identification evidence'
    );
    expect(prompt).toContain(
      'do not accept a candidate just because the delegate handle appears as a substring inside a longer ENS, address label, or display name'
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

  it('documents the exact propose_delegate_mapping target contract', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'for mappingType=delegate_to_discourse_user, targetId must be the exact discourse_users.id UUID from a queried row'
    );
    expect(prompt).toContain(
      'for mappingType=delegate_to_voter, targetId may be the exact voters.id UUID, exact voters.address, or exact voters.ens from a queried row'
    );
    expect(prompt).toContain(
      'if propose_delegate_mapping rejects a target format or says the target was not found, that is a tool-contract problem, not evidence that the identity is wrong'
    );
  });

  it('requires at least ten reads before deciding and hurries after twenty', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'if you try to decide before 10 reads, the decision tool will tell you to gather more evidence first'
    );
    expect(prompt).toContain(
      'you must complete at least 10 query_delegate_mapping_data calls before either proposing or declining'
    );
    expect(prompt).toContain(
      '10 queries is a hard minimum before any decision tool is allowed'
    );
    expect(prompt).toContain(
      'around 20 reads or 5 minutes, the harness will strongly nudge you to decide'
    );
  });
});

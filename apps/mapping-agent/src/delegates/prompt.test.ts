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
      'if a self-authored thread explicitly lists an address or ENS, immediately query voters for that exact address or ENS and then query votes for that exact voter_address; do this before any generic voter discovery'
    );
    expect(prompt).toContain(
      'when current_case gives source_discourse_user_id, query that exact discourse_users row early so you have the canonical username, name, dao_discourse_id, and external_id before touching raw forum tables'
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
      'a communication thread remains a high-priority identity source even if the title or body says the delegate later retired, stepped down, or is no longer active'
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

  it('treats thread-derived Tally and address breadcrumbs as exact leads and not optional context', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'fields like Delegate Address, Delegate ENS Address, Wallet Address or ENS, Tally Profile, Snapshot Profile, Forum Username, Telegram Username, or Twitter Profile are concrete identity breadcrumbs'
    );
    expect(prompt).toContain(
      'if a self-authored thread links to a Tally or Snapshot profile whose URL contains an address or ENS, treat that extracted address or ENS as a concrete identity breadcrumb'
    );
    expect(prompt).toContain(
      'if a self-authored thread gives an exact address or ENS and that exact address or ENS resolves to a voter row, that is usually enough direct identity proof to propose unless contradictory evidence appears'
    );
  });

  it('tells the agent to correct raw forum schema mistakes instead of bailing into a decline', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'on raw forum tables, use the exact raw names and columns: discourse_post is singular, discourse_topic is singular, and discourse_post.user_id stores the discourse user external_id, not the discourse_users.id UUID'
    );
    expect(prompt).toContain(
      'if your first attempt to inspect raw forum tables fails because of a wrong table or column name, correct the SQL using the exact names above and continue; do not treat a schema mistake as substantive evidence and do not move to decline because of it'
    );
    expect(prompt).toContain(
      'do not use unrelated schema-probing reads like select * from discourse_post limit 1 or select * from daos limit 1 when the current_case and discourse user rows already tell you what to inspect next'
    );
  });
});

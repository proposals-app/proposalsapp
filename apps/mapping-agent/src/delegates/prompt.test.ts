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
    expect(prompt).toContain(
      'prefer identity-establishing self-started topics over the newest topics; sort by identity signal, not recency'
    );
  });

  it('treats exact vote-reason forum links as primary identity breadcrumbs', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'an exact vote reason link that includes ?u=<forum username> for the same discourse username is strong direct proof'
    );
    expect(prompt).toContain(
      'if many exact ?u=<forum username> vote reasons all point to the same voter_address, that repeated 1:1 pattern is usually enough direct identity proof'
    );
    expect(prompt).toContain(
      'when a vote reason links to a forum post without ?u=, query the linked raw discourse_post and verify whether its topic_id and author match the same discourse user before treating the voter_address as proof'
    );
  });

  it('teaches the agent to use organization brands alongside personal usernames', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'when the discourse identity mixes a personal handle and an organization or delegate brand, treat both strings as exact identity leads'
    );
    expect(prompt).toContain(
      'an organization-branded communication thread or self-authored profile thread that lists an exact address, ENS, Tally profile, or Snapshot profile is strong direct proof'
    );
    expect(prompt).toContain(
      'if the discourse row exposes both a personal username and an organization or delegate brand in the name/title, run targeted exact searches for both on the voter side, in vote reasons, and in self-authored topic titles before giving up'
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
    expect(prompt).toContain(
      'technical constraints, min-query rejections, target-format errors, target-not-found errors, empty helper relations, or one failed raw read are not substantive evidence and must never be the reason for a decline'
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

  it('tells the agent that exact wallet proof can still be mapped without dao activity rows', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'the global voters relation is the canonical exact wallet-identity registry for propose_delegate_mapping'
    );
    expect(prompt).toContain(
      'a lack of current vote rows or voting power rows in the DAO does not by itself invalidate an otherwise well-proven wallet identity'
    );
    expect(prompt).toContain(
      'voters has no dao_id, so never filter voters by dao_id'
    );
  });

  it('tells the agent to treat org or tally profile slugs as leads until it reaches an exact voter identifier', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'if a Tally, Snapshot, forum, or organization profile slug is not itself an exact voters.ens, treat it as a lead rather than a final target'
    );
    expect(prompt).toContain(
      'do not propose an organization, profile, or brand alias unless that exact string appears in a queried voters row'
    );
  });

  it('requires at least five reads before deciding and hurries after twenty', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'if you try to decide before 5 reads, the decision tool will tell you to gather more evidence first'
    );
    expect(prompt).toContain(
      'you must complete at least 5 query_delegate_mapping_data calls before either proposing or declining'
    );
    expect(prompt).toContain(
      '5 queries is a hard minimum before any decision tool is allowed'
    );
    expect(prompt).toContain(
      'around 20 reads or 5 minutes, the harness will strongly nudge you to decide'
    );
  });

  it('tells the agent to use known identity patterns first, then broaden only if they fail', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'use a two-phase search strategy: exhaust the known high-signal identity patterns first, and only then broaden into exploratory work'
    );
    expect(prompt).toContain(
      'known high-signal patterns include: self-started communication or statement threads, exact thread-derived addresses or ENS names, exact ?u=<username> vote-reason links, exact links to the discourse user own posts, and exact organization-brand breadcrumbs'
    );
    expect(prompt).toContain(
      'only if those focused checks fail should you broaden into exploratory work such as wider post inspection, broader vote-reason searches, or carefully targeted voter discovery'
    );
  });

  it('tells the agent to spend any remaining minimum-budget reads on lightweight confirmation queries', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'if you reach a confident mapping before the 5-read minimum, spend the remaining required reads on lightweight confirmation queries rather than opening heavy exploratory reads'
    );
    expect(prompt).toContain(
      'good lightweight confirmation queries include exact voter lookups, exact vote-address checks, exact ens checks, exact current_delegate_voters checks, or exact active_delegate_to_voters conflict checks'
    );
    expect(prompt).toContain(
      'do not respond to an early-conclusive case by opening broad raw-post dumps or generic exploratory scans just to consume the remaining minimum-read budget'
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

  it('pushes the agent toward narrow exact-column reads and case-insensitive wallet lookups', () => {
    const prompt = buildDelegateSystemPrompt({
      confidenceThreshold: 0.85,
      maxQueryCalls: 30,
      timeoutMs: 300_000,
      daoId: 'dao-id',
      delegateId: 'delegate-id',
      schemaExport: 'schema',
    });

    expect(prompt).toContain(
      'on large raw tables like discourse_post, vote, and voter, prefer narrow exact-column reads over select *'
    );
    expect(prompt).toContain(
      'once you have an exact wallet address, query voter with a case-insensitive exact match such as lower(address) = lower('
    );
    expect(prompt).toContain(
      'when you already know the exact address or ENS from a communication thread, do not fall back to broad voter discovery first'
    );
    expect(prompt).toContain(
      'when you only need to verify whether an exact wallet exists, prefer selecting id, address, ens rather than every column'
    );
  });
});

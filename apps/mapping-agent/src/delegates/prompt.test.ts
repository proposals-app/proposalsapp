import { describe, expect, it } from 'vitest';

import { buildDelegateSystemPrompt } from './prompt';

function makePrompt() {
  return buildDelegateSystemPrompt({
    confidenceThreshold: 0.85,
    maxQueryCalls: 30,
    timeoutMs: 300_000,
    daoId: 'dao-id',
    delegateId: 'delegate-id',
    schemaExport: 'schema',
  });
}

describe('buildDelegateSystemPrompt', () => {
  it('is sectioned and still reasonably compact even with embedded SQL templates', () => {
    const prompt = makePrompt();

    expect(prompt).toContain('Mission:');
    expect(prompt).toContain('Tool Protocol:');
    expect(prompt).toContain('Workflow:');
    expect(prompt).toContain('Strong Proof:');
    expect(prompt).toContain('Weak Or Invalid Proof:');
    expect(prompt).toContain('Shared-Wallet Confirmation:');
    expect(prompt).toContain('Known SQL Patterns:');
    expect(prompt).toContain('SQL And Budget Rules:');
    expect(prompt).toContain('Decision Standard:');
    expect(prompt.split('\n').length).toBeLessThanOrEqual(260);
  });

  it('uses native tool-calling guidance instead of manual wrappers', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      'Use the provided native tools whenever you need more evidence or are ready to decide.'
    );
    expect(prompt).toContain(
      'Plain-text reasoning between tool calls is allowed, but only native tool calls can query evidence or finish the case.'
    );
    expect(prompt).toContain(
      'Do not print fake tool syntax, bracketed wrappers, or JSON blobs that imitate tool calls.'
    );
    expect(prompt).toContain(
      'If you need a tool, call the tool directly through the native tool interface.'
    );
    expect(prompt).not.toContain('[TOOL_REQUEST]');
    expect(prompt).not.toContain('[PROPOSE_DELEGATE_MAPPING]');
  });

  it('defines a concise evidence ladder with the strongest known identity paths', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      'Keep DAO and forum scope strict. Use forum evidence only from the current dao_discourse_id, and treat same-DAO vote activity in the current dao_id as the primary voter validation for this case.'
    );
    expect(prompt).toContain(
      'Follow this evidence ladder unless a step is unavailable: exact discourse row -> self-started identity-thread titles -> post #1 of the best identity thread -> authored exact breadcrumb resolution across self-authored posts -> deterministic vote-reason link-to-post-author query -> only then targeted exploratory work.'
    );
    expect(prompt).toContain(
      'If the discourse username itself is a full ENS such as ostanescu.eth, check exact voter ENS equality early.'
    );
    expect(prompt).toContain(
      "Self-introduction posts and self-authored application/signup posts are high-signal when they explicitly state the author's own wallet, ENS, Tally profile, or Snapshot profile."
    );
    expect(prompt).toContain(
      'In Arbitrum, self-authored Delegate Statement Template, Incentive Program Delegate Application, What is (Re)delegation Week, RAD, DIP, and Karma wallet-link posts are high-signal when they include an exact wallet, ENS, or Tally/Snapshot breadcrumb.'
    );
    expect(prompt).toContain(
      'In Uniswap, self-authored titles like Delegate Platform, Delegate Communication Thread, Delegate your UNI Votes to..., and delegate reward/application threads are high-signal identity sources.'
    );
    expect(prompt).toContain(
      'If exact ENS equality fails, that does not mean the case is close to decline.'
    );
    expect(prompt).toContain(
      'When the discourse name carries an organization brand but the username does not match the wallet ENS'
    );
    expect(prompt).toContain(
      'Before declining, run an authored exact breadcrumb resolution query across the current user’s own posts.'
    );
    expect(prompt).toContain(
      "Later self-authored posts can mention many third-party addresses. Prefer the candidate that recurs across the author's own identity, application, delegate-statement, or wallet-link posts"
    );
    expect(prompt).toContain(
      'Use three search modes and stay in the highest-signal one you can: direct-proof mode, sparse-user fallback mode, and org/shared-wallet mode.'
    );
    expect(prompt).toContain(
      'Direct-proof mode: if you find a self-authored exact wallet, exact ENS, or exact Tally/Snapshot breadcrumb that resolves to a canonical voter row, stay on that path and finish the case instead of exploring broader alternatives.'
    );
    expect(prompt).toContain(
      'Sparse-user fallback mode: if discourse_users.topic_count or post_count is zero, stale, or obviously incomplete, check raw discourse_post for that exact external_id early.'
    );
    expect(prompt).toContain(
      'Org/shared-wallet mode: if the discourse name, self-authored thread titles, or self-authored posts clearly indicate an organization, check for exact org wallet breadcrumbs, org ENS, or repeated vote-link evidence for that org wallet.'
    );
    expect(prompt).toContain(
      'Read whether the user is speaking as an individual or on behalf of a delegation/team/org.'
    );
    expect(prompt).toContain(
      'When using vote-reason links, treat them as a distribution problem inside the current DAO/forum: check whether the candidate wallet links mostly to the current user, to a tight same-org cluster, or mostly to someone else.'
    );
    expect(prompt).toContain(
      'Once you have direct authored proof plus an exact voter row and same-DAO vote activity, propose immediately.'
    );
  });

  it('keeps the strongest literal SQL templates explicit', () => {
    const prompt = makePrompt();

    expect(prompt).toContain('self-started identity-thread titles query:');
    expect(prompt).toContain('join discourse_topic t');
    expect(prompt).toContain('authored exact-breadcrumb scan:');
    expect(prompt).toContain("where lower(p.cooked) ~ '0x[a-f0-9]{40}'");
    expect(prompt).toContain('authored exact-breadcrumb resolution query:');
    expect(prompt).toContain('extracted_address');
    expect(prompt).toContain('same_dao_vote_count');
    expect(prompt).toContain('Arbitrum application-thread scan:');
    expect(prompt).toContain(
      "where lower(t.title) ~ '(rad|dip|delegate incentive|rewarding active delegates|application thread)'"
    );
    expect(prompt).toContain(
      'deterministic vote-reason link-to-post-author query:'
    );
    expect(prompt).toContain('with case_ctx as (');
    expect(prompt).toContain("where v.reason like '%/t/%/%/%'");
    expect(prompt).toContain(
      'join discourse_post dp on dp.topic_id = vl.topic_id and dp.post_number = vl.post_number'
    );
    expect(prompt).toContain('exact ENS fallback query:');
    expect(prompt).toContain(
      'join voters v on lower(v.ens) = lower(c.username)'
    );
  });

  it('separates strong proof from weak or invalid proof', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      "A self-authored identity thread that explicitly lists the author's own wallet address, ENS, Tally profile, Snapshot profile, or equivalent exact breadcrumb."
    );
    expect(prompt).toContain(
      'An exact wallet or ENS extracted from the current user’s own posts that resolves to a canonical voter row with same-DAO vote activity.'
    );
    expect(prompt).toContain(
      'The same exact wallet or ENS recurring across multiple self-authored identity, application, delegate-statement, or wallet-link posts.'
    );
    expect(prompt).toContain(
      'Exact self-authored wallet or ENS breadcrumbs remain strong proof even if a vote-reason link search later fails or finds no results.'
    );
    expect(prompt).toContain(
      'Repeated exact vote-reason links from one voter_address to posts authored by the current discourse user are among the strongest signals in the data.'
    );
    expect(prompt).toContain(
      'A candidate wallet whose vote-reason links overwhelmingly resolve to the current discourse user in this same DAO/forum is strong corroboration'
    );
    expect(prompt).toContain(
      'For shared-org cases, a candidate wallet whose vote-reason links resolve to a tight same-org cluster in this same DAO/forum can support confirm=true when combined with exact org-level evidence.'
    );
    expect(prompt).toContain(
      'Direct authored proof plus an exact voter row plus same-DAO vote activity is sufficient to propose immediately unless you have concrete contrary evidence.'
    );
    expect(prompt).toContain(
      'A ?u=<forum username> vote-reason link is strong when it also resolves to a post authored by the current discourse user.'
    );
    expect(prompt).toContain(
      'A ?u=<username> parameter in a shared Discourse URL is supporting context, not standalone proof, because Discourse appends the sharer username to copied share links for tracking and badges.'
    );
    expect(prompt).toContain(
      'Treat ?u=<current username> as strong only when it lines up with the current user and the linked post/thread authorship also checks out'
    );
    expect(prompt).toContain(
      'Do not mix DAOs or forums. A delegate on one DAO forum must map to a wallet evidenced in that same forum and validated against votes in that same DAO; activity in another DAO or another forum is only supporting context and is never enough to accept.'
    );
    expect(prompt).toContain(
      'If a candidate wallet has zero vote-reason links to the current discourse user in the current DAO/forum, do not accept it on vote-link logic alone.'
    );
    expect(prompt).toContain(
      'If a candidate wallet links mostly to other users and only incidentally to the current discourse user, treat that as contrary evidence rather than support.'
    );
    expect(prompt).toContain(
      'Recommendation language such as "delegate to", "delegate our votes to", "I delegated to", "support", or "follow" is evidence about the referenced target, not proof that the current author owns that wallet.'
    );
    expect(prompt).toContain(
      'Same employer, same ecosystem, same organization, same grant application, or same team page is not wallet proof.'
    );
    expect(prompt).toContain(
      'Addresses or ENS names that appear only inside later proposal updates, quoted material, or lists of other delegates are not proof that the current author owns them'
    );
    expect(prompt).toContain(
      'If a linked forum post is authored by a different discourse user than the current case, that is contrary evidence for this line of proof unless you can show an explicit alias or rename connection.'
    );
    expect(prompt).toContain(
      'If the strongest link is only a common name or a generic handle, decline.'
    );
    expect(prompt).toContain(
      'discourse_users.topic_count = 0 or post_count = 0 is not substantive evidence. Those counters can be stale; inspect raw discourse_post before using missing activity as part of a decline.'
    );
  });

  it('keeps the shared-wallet confirm flow but makes it stricter', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      'For delegate_to_voter proposals, call propose_delegate_mapping with confirm=false first.'
    );
    expect(prompt).toContain(
      'If propose_delegate_mapping returns requiresConfirmation=true, the exact voter is already linked to one or more other delegates in this DAO.'
    );
    expect(prompt).toContain(
      'Retry the same exact voter with confirm=true only when you have explicit shared-wallet proof'
    );
    expect(prompt).toContain(
      'Real shared-wallet cases often come from organization delegates where multiple discourse users speak for one org wallet; require exact wallet evidence for that org case, not just same-org affiliation.'
    );
    expect(prompt).toContain(
      'Same org or team membership alone is not enough for confirm=true.'
    );
  });

  it('clarifies how query results and query errors should be interpreted', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      'Tool results are structured JSON. Read ok, rowCount, rows, budget, warning, error, and attemptedSql carefully before deciding what to do next.'
    );
    expect(prompt).toContain(
      'When a query result has ok=false, treat it as SQL or tool-contract feedback. Repair the SQL and continue.'
    );
    expect(prompt).toContain(
      'Failed read queries do not advance the read budget.'
    );
    expect(prompt).toContain(
      'Never request discourse_post.cooked across all posts by a user or topic.'
    );
    expect(prompt).toContain(
      'If you need cooked text, fetch it only for one exact post, one exact topic first post, or a very small LIMIT after a metadata or breadcrumb scan has already narrowed the target.'
    );
    expect(prompt).toContain(
      'If a query times out, retry the same intent with fewer columns, tighter predicates, a smaller LIMIT, or an exact address/ENS filter. Do not respond to a timeout by switching to a broader exploratory search.'
    );
  });

  it('preserves the exact target contract and exact-address guidance', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      'For mappingType=delegate_to_discourse_user, targetId must be the exact discourse_users.id UUID from a queried row.'
    );
    expect(prompt).toContain(
      'For mappingType=delegate_to_voter, targetId may be the exact voters.id UUID, exact voters.address, or exact voters.ens from a queried row.'
    );
    expect(prompt).toContain(
      "Once you have an exact wallet address, resolve voters with a case-insensitive exact match such as lower(address) = lower('<address>')."
    );
  });

  it('keeps the decision budget and stop conditions clear', () => {
    const prompt = makePrompt();

    expect(prompt).toContain(
      'You must complete at least 5 successful query_delegate_mapping_data calls before either proposing or declining.'
    );
    expect(prompt).toContain(
      'If you reach a confident mapping before the 5-read minimum, spend the remaining required reads on lightweight confirmation queries rather than heavy exploratory reads.'
    );
    expect(prompt).toContain(
      'Do not inspect how unrelated delegates are mapped, sample random voters, or browse historical mapping rows unless you are validating one specific candidate or a shared-wallet conflict returned by propose_delegate_mapping.'
    );
    expect(prompt).toContain(
      'Around 20 reads or 5 minutes, wrap up. After 30 read calls, the read tool will stop accepting more reads and you must decide.'
    );
    expect(prompt).toContain(
      'If confidence is below 0.85, call decline_delegate_mapping.'
    );
    expect(prompt).toContain(
      'End with exactly one of propose_delegate_mapping or decline_delegate_mapping.'
    );
  });
});

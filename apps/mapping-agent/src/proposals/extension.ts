import { Type } from '@sinclair/typebox';
import type {
  ExtensionAPI,
  ExtensionFactory,
} from '@mariozechner/pi-coding-agent';
import { errorToolResponse, textToolResponse } from '../shared/tool-response';
import {
  attachProposalToGroup,
  declineProposalMapping,
  queryProposalMappingData,
} from './repository';
import {
  buildHurryMessage,
  buildMinQueryError,
  getQueryBudgetSnapshot,
  serializeQueryBudget,
  type QueryBudgetConfig,
} from '../shared/query-budget';

export interface ProposalMappingCase {
  daoId: string;
  proposalId: string;
  allowedCategoryIds: number[];
  threshold: number;
  budget: Omit<
    QueryBudgetConfig,
    'queryToolName' | 'decisionToolNames' | 'minQueryCallsBeforeDecision'
  >;
}

const MIN_QUERY_CALLS_BEFORE_DECISION = 5;

export function createProposalExtension(
  currentCase: ProposalMappingCase
): ExtensionFactory {
  return function registerProposalExtension(pi: ExtensionAPI) {
    let queryCount = 0;
    const budgetConfig: QueryBudgetConfig = {
      ...currentCase.budget,
      minQueryCallsBeforeDecision: MIN_QUERY_CALLS_BEFORE_DECISION,
      queryToolName: 'query_proposal_mapping_data',
      decisionToolNames: [
        'propose_proposal_group_mapping',
        'decline_proposal_group_mapping',
      ],
    };

    pi.registerTool({
      name: 'query_proposal_mapping_data',
      label: 'Query Proposal Mapping Data',
      description:
        'Run a single read-only SQL SELECT/CTE statement against the global proposal mapping relations current_case, allowed_categories, daos, dao_discourses, dao_governors, proposals, discourse_topics, proposal_groups, proposal_group_items, proposal_group_topics, and proposal_group_proposals. Reads may span any DAO. Only the propose callback validates same-DAO writes and group invariants.',
      parameters: Type.Object({
        sql: Type.String(),
      }),
      async execute(_toolCallId, input) {
        const preQueryBudget = getQueryBudgetSnapshot(budgetConfig, queryCount);
        if (preQueryBudget.isDecisionOnly) {
          return textResponse({
            ok: false,
            error:
              'The read-query budget is exhausted for this case. query_proposal_mapping_data will no longer be accepted; use a decision tool instead.',
            budget: serializeQueryBudget(preQueryBudget),
            warning: buildHurryMessage(budgetConfig, preQueryBudget),
          });
        }

        queryCount += 1;

        try {
          const result = await queryProposalMappingData({
            daoId: currentCase.daoId,
            proposalId: currentCase.proposalId,
            allowedCategoryIds: currentCase.allowedCategoryIds,
            input: input as { sql: string },
          });
          const postQueryBudget = getQueryBudgetSnapshot(
            budgetConfig,
            queryCount
          );
          const hurryMessage = buildHurryMessage(budgetConfig, postQueryBudget);

          return textResponse({
            ok: true,
            ...result,
            budget: serializeQueryBudget(postQueryBudget),
            ...(hurryMessage ? { warning: hurryMessage } : {}),
          });
        } catch (error) {
          const budget = getQueryBudgetSnapshot(budgetConfig, queryCount);
          const hurryMessage = buildHurryMessage(budgetConfig, budget);
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          return textResponse({
            ok: false,
            error: errorMessage,
            attemptedSql: (input as { sql: string }).sql,
            budget: serializeQueryBudget(budget),
            ...(hurryMessage ? { warning: hurryMessage } : {}),
          });
        }
      },
    });

    pi.registerTool({
      name: 'propose_proposal_group_mapping',
      label: 'Propose Proposal Group Mapping',
      description:
        'Attach the current proposal to a same-DAO proposal group after validating the group invariant and confidence threshold.',
      parameters: Type.Object({
        groupId: Type.String(),
        confidence: Type.Number(),
        reason: Type.String(),
        evidenceIds: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_toolCallId, input) {
        const proposalInput = input as unknown as {
          groupId: string;
          confidence: number;
          reason: string;
          evidenceIds?: string[];
        };

        try {
          const budget = getQueryBudgetSnapshot(budgetConfig, queryCount);
          if (budget.queryCount === 0 || budget.minQueriesRemaining > 0) {
            return textToolResponse(buildMinQueryError(budgetConfig, budget));
          }

          const result = await attachProposalToGroup({
            daoId: currentCase.daoId,
            proposalId: currentCase.proposalId,
            groupId: proposalInput.groupId,
            confidence: proposalInput.confidence,
            threshold: currentCase.threshold,
            reason: proposalInput.reason,
            evidenceIds: proposalInput.evidenceIds ?? [],
            decisionSource: 'agent',
          });

          return textResponse({
            ...result,
            budget: serializeQueryBudget(budget),
          });
        } catch (error) {
          return errorToolResponse(error);
        }
      },
    });

    pi.registerTool({
      name: 'decline_proposal_group_mapping',
      label: 'Decline Proposal Group Mapping',
      description:
        'Decline the current proposal mapping case when no same-DAO discussion group is confidently correct. The harness will place the proposal into the per-DAO UNKNOWN fallback group.',
      parameters: Type.Object({
        reason: Type.String(),
        evidenceIds: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_toolCallId, input) {
        const declineInput = input as unknown as {
          reason: string;
          evidenceIds?: string[];
        };

        const budget = getQueryBudgetSnapshot(budgetConfig, queryCount);
        if (budget.queryCount === 0 || budget.minQueriesRemaining > 0) {
          return textToolResponse(buildMinQueryError(budgetConfig, budget));
        }

        const result = await declineProposalMapping({
          daoId: currentCase.daoId,
          proposalId: currentCase.proposalId,
          reason: declineInput.reason,
          evidenceIds: declineInput.evidenceIds ?? [],
          decisionSource: 'agent',
        });

        return textResponse({
          ...result,
          budget: serializeQueryBudget(budget),
        });
      },
    });
  };
}

function textResponse(value: unknown) {
  return textToolResponse(value);
}

function getProposalCaseFromEnv(): ProposalMappingCase {
  const daoId = process.env.MAPPING_AGENT_CASE_DAO_ID;
  const proposalId = process.env.MAPPING_AGENT_CASE_PROPOSAL_ID;
  const allowedCategoryIds = process.env.MAPPING_AGENT_ALLOWED_CATEGORY_IDS;
  const threshold = process.env.MAPPING_AGENT_PROPOSAL_CONFIDENCE_THRESHOLD;
  const timeoutMs = process.env.MAPPING_AGENT_PI_SESSION_TIMEOUT_MS;
  const maxQueryCalls = process.env.MAPPING_AGENT_PI_MAX_QUERY_CALLS;

  if (
    !daoId ||
    !proposalId ||
    !allowedCategoryIds ||
    !threshold ||
    !timeoutMs ||
    !maxQueryCalls
  ) {
    throw new Error('Missing proposal mapping case environment');
  }

  return {
    daoId,
    proposalId,
    allowedCategoryIds: JSON.parse(allowedCategoryIds) as number[],
    threshold: Number.parseFloat(threshold),
    budget: {
      startedAtMs: Date.now(),
      timeoutMs: Number.parseInt(timeoutMs, 10),
      maxQueryCalls: Number.parseInt(maxQueryCalls, 10),
    },
  };
}

export default function registerProposalExtensionFromEnv(pi: ExtensionAPI) {
  return createProposalExtension(getProposalCaseFromEnv())(pi);
}

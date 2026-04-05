import { Type } from '@sinclair/typebox';
import type {
  ExtensionAPI,
  ExtensionFactory,
} from '@mariozechner/pi-coding-agent';
import { errorToolResponse, textToolResponse } from '../shared/tool-response';
import {
  declineDelegateMapping,
  proposeDelegateMapping,
  queryDelegateMappingData,
} from './repository';
import {
  buildHurryMessage,
  buildMinQueryError,
  getQueryBudgetSnapshot,
  serializeQueryBudget,
  type QueryBudgetConfig,
} from '../shared/query-budget';

export interface DelegateMappingCase {
  daoId: string;
  delegateId: string;
  allowedCategoryIds: number[];
  threshold: number;
  budget: Omit<
    QueryBudgetConfig,
    'queryToolName' | 'decisionToolNames' | 'minQueryCallsBeforeDecision'
  >;
}

const MIN_QUERY_CALLS_BEFORE_DECISION = 10;

export function createDelegateExtension(
  currentCase: DelegateMappingCase
): ExtensionFactory {
  return function registerDelegateExtension(pi: ExtensionAPI) {
    let queryCount = 0;
    const budgetConfig: QueryBudgetConfig = {
      ...currentCase.budget,
      minQueryCallsBeforeDecision: MIN_QUERY_CALLS_BEFORE_DECISION,
      queryToolName: 'query_delegate_mapping_data',
      decisionToolNames: [
        'propose_delegate_mapping',
        'decline_delegate_mapping',
      ],
    };

    pi.registerTool({
      name: 'query_delegate_mapping_data',
      label: 'Query Delegate Mapping Data',
      description:
        'Run a single read-only SQL SELECT/CTE statement against the global delegate mapping relations current_case, daos, dao_discourses, delegates, discourse_users, voters, delegate_to_discourse_users, delegate_to_voters, active_delegate_to_discourse_users, active_delegate_to_voters, current_delegate_discourse_users, current_delegate_voters, votes, and voting_power_timeseries. Reads may span any DAO. Only the propose callback validates same-DAO writes and claim conflicts.',
      parameters: Type.Object({
        sql: Type.String(),
      }),
      async execute(_toolCallId, input) {
        const preQueryBudget = getQueryBudgetSnapshot(budgetConfig, queryCount);
        if (preQueryBudget.isDecisionOnly) {
          return textResponse({
            ok: false,
            error:
              'The read-query budget is exhausted for this case. query_delegate_mapping_data will no longer be accepted; use a decision tool instead.',
            budget: serializeQueryBudget(preQueryBudget),
            warning: buildHurryMessage(budgetConfig, preQueryBudget),
          });
        }

        queryCount += 1;

        try {
          const result = await queryDelegateMappingData({
            daoId: currentCase.daoId,
            delegateId: currentCase.delegateId,
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

          return textResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            attemptedSql: (input as { sql: string }).sql,
            budget: serializeQueryBudget(budget),
            ...(hurryMessage ? { warning: hurryMessage } : {}),
          });
        }
      },
    });

    pi.registerTool({
      name: 'propose_delegate_mapping',
      label: 'Propose Delegate Mapping',
      description:
        'Suggest a delegate mapping. For delegate_to_discourse_user, targetId must be the exact discourse_users.id UUID. For delegate_to_voter, targetId may be the exact voters.id UUID, exact voters.address, or exact voters.ens copied verbatim from a queried row. The harness resolves voter address/ENS to the canonical same-DAO voter row, then validates same-DAO ownership, claim conflicts, and confidence before any write is accepted.',
      parameters: Type.Object({
        mappingType: Type.Union([
          Type.Literal('delegate_to_discourse_user'),
          Type.Literal('delegate_to_voter'),
        ]),
        targetId: Type.String({
          description:
            'If mappingType=delegate_to_discourse_user, use the exact discourse_users.id UUID. If mappingType=delegate_to_voter, use the exact voters.id UUID, voters.address, or voters.ens copied verbatim from a queried row.',
        }),
        confidence: Type.Number(),
        reason: Type.String(),
        evidenceIds: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_toolCallId, input) {
        const mappingInput = input as unknown as {
          mappingType: 'delegate_to_discourse_user' | 'delegate_to_voter';
          targetId: string;
          confidence: number;
          reason: string;
          evidenceIds?: string[];
        };

        try {
          const budget = getQueryBudgetSnapshot(budgetConfig, queryCount);
          if (budget.queryCount === 0 || budget.minQueriesRemaining > 0) {
            return textToolResponse(buildMinQueryError(budgetConfig, budget));
          }

          const result = await proposeDelegateMapping({
            daoId: currentCase.daoId,
            delegateId: currentCase.delegateId,
            mappingType: mappingInput.mappingType,
            targetId: mappingInput.targetId,
            confidence: mappingInput.confidence,
            threshold: currentCase.threshold,
            reason: mappingInput.reason,
            evidenceIds: mappingInput.evidenceIds ?? [],
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
      name: 'decline_delegate_mapping',
      label: 'Decline Delegate Mapping',
      description:
        'Decline the current delegate mapping case when no same-DAO identity target is confidently correct.',
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

        await declineDelegateMapping({
          daoId: currentCase.daoId,
          delegateId: currentCase.delegateId,
          reason: declineInput.reason,
          evidenceIds: declineInput.evidenceIds ?? [],
          decisionSource: 'agent',
        });

        return textResponse({
          declined: true,
          budget: serializeQueryBudget(budget),
        });
      },
    });
  };
}

function textResponse(value: unknown) {
  return textToolResponse(value);
}

function getDelegateCaseFromEnv(): DelegateMappingCase {
  const daoId = process.env.MAPPING_AGENT_CASE_DAO_ID;
  const delegateId = process.env.MAPPING_AGENT_CASE_DELEGATE_ID;
  const threshold = process.env.MAPPING_AGENT_DELEGATE_CONFIDENCE_THRESHOLD;
  const timeoutMs = process.env.MAPPING_AGENT_PI_SESSION_TIMEOUT_MS;
  const maxQueryCalls = process.env.MAPPING_AGENT_PI_MAX_QUERY_CALLS;

  if (!daoId || !delegateId || !threshold || !timeoutMs || !maxQueryCalls) {
    throw new Error('Missing delegate mapping case environment');
  }

  return {
    daoId,
    delegateId,
    allowedCategoryIds: [],
    threshold: Number.parseFloat(threshold),
    budget: {
      startedAtMs: Date.now(),
      timeoutMs: Number.parseInt(timeoutMs, 10),
      maxQueryCalls: Number.parseInt(maxQueryCalls, 10),
    },
  };
}

export default function registerDelegateExtensionFromEnv(pi: ExtensionAPI) {
  return createDelegateExtension(getDelegateCaseFromEnv())(pi);
}

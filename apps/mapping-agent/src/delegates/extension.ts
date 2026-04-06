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

const MIN_QUERY_CALLS_BEFORE_DECISION = 5;

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
        'Run a single read-only SQL SELECT/CTE statement against the delegate-mapping helper relations and the raw public tables exposed in the schema export. In addition to current_case, discourse_users, voters, delegate_to_discourse_users, delegate_to_voters, current_delegate_discourse_users, current_delegate_voters, votes, and voting_power_timeseries, you may inspect raw public discourse_topic, discourse_post, dao_discourse, vote, and voter rows when you need first-post, communication-thread, or vote-reason evidence. Reads may span any DAO. For delegate_to_voter writes, the propose callback resolves exact targets against the global voters table, then validates claim conflicts within the current DAO.',
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

        try {
          const result = await queryDelegateMappingData({
            daoId: currentCase.daoId,
            delegateId: currentCase.delegateId,
            allowedCategoryIds: currentCase.allowedCategoryIds,
            input: input as { sql: string },
          });
          queryCount += 1;
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
          const hurryMessage = buildHurryMessage(budgetConfig, preQueryBudget);

          return textResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            attemptedSql: (input as { sql: string }).sql,
            budget: serializeQueryBudget(preQueryBudget),
            ...(hurryMessage ? { warning: hurryMessage } : {}),
          });
        }
      },
    });

    pi.registerTool({
      name: 'propose_delegate_mapping',
      label: 'Propose Delegate Mapping',
      description:
        'Suggest a delegate mapping. For delegate_to_discourse_user, targetId must be the exact discourse_users.id UUID. For delegate_to_voter, targetId may be the exact voters.id UUID, exact voters.address, or exact voters.ens copied verbatim from a queried row. Call delegate_to_voter proposals with confirm=false first. If the exact voter is already linked to another delegate, the tool will return requiresConfirmation=true plus the conflicting delegate labels instead of writing. Retry with confirm=true only when you have strong shared-org or shared-team wallet proof. The harness resolves voter address/ENS to the canonical global voter row, then validates within-DAO claim conflicts and confidence before any write is accepted. Empty DAO helper relations, low current activity, or a retired delegate status do not invalidate an otherwise well-proven exact wallet identity.',
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
        confirm: Type.Optional(
          Type.Boolean({
            description:
              'Only relevant for mappingType=delegate_to_voter. Use false first. Set true only after the tool says requiresConfirmation=true and you have strong evidence that multiple discourse users intentionally share the same org/team wallet.',
          })
        ),
      }),
      async execute(_toolCallId, input) {
        const mappingInput = input as unknown as {
          mappingType: 'delegate_to_discourse_user' | 'delegate_to_voter';
          targetId: string;
          confidence: number;
          reason: string;
          evidenceIds?: string[];
          confirm?: boolean;
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
            confirm: mappingInput.confirm,
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
        'Decline the current delegate mapping case only when identity remains genuinely ambiguous after checking direct breadcrumbs such as self-authored threads, exact vote-reason links, exact addresses, and exact ENS leads. Do not use this tool to explain technical constraints, target-format issues, sparse helper relations, or missing current DAO activity.',
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

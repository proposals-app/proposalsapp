import type { Logger } from 'pino';
import type { MappingAgentConfig } from '../config';
import { PiAgentSessionAbortedError, runPiAgent } from '../runtime/pi-runner';
import { createAgentSessionLogger } from '../shared/agent-observability';
import { loadEnabledDaos } from '../shared/dao';
import { getPublicSchemaExport } from '../shared/schema-export';
import { createProposalExtension } from './extension';
import { buildProposalPrompt, buildProposalSystemPrompt } from './prompt';
import {
  fallbackProposalToUnknownGroup,
  runDeterministicProposalGrouping,
} from './repository';

export async function runProposalMappingWorker(
  config: MappingAgentConfig,
  logger: Logger
): Promise<void> {
  const daos = await loadEnabledDaos(config.enabledDaoSlugs);
  const schemaExport = await getPublicSchemaExport([
    'dao',
    'dao_discourse',
    'dao_governor',
    'proposal',
    'discourse_topic',
    'proposal_group',
  ]);

  for (const dao of daos) {
    const allowedCategoryIds = config.daoCategoryFilters[dao.slug] ?? [];
    const { context, result } = await runDeterministicProposalGrouping({
      daoSlug: dao.slug,
      allowedCategoryIds,
    });

    if (!context || !result) {
      logger.info(
        { daoSlug: dao.slug },
        'Skipping proposal mapping without discourse context'
      );
      continue;
    }

    logger.info(
      {
        daoSlug: dao.slug,
        urlMatchedProposals: result.urlMatchedProposalIds.length,
        unresolvedProposals: result.unresolvedProposalIds.length,
      },
      'Completed deterministic proposal grouping pass'
    );

    if (result.unresolvedProposalIds.length === 0) {
      continue;
    }

    if (!config.pi.provider || !config.pi.model) {
      logger.warn(
        {
          daoSlug: dao.slug,
          unresolvedProposals: result.unresolvedProposalIds.length,
        },
        'Proposal agent is disabled because pi provider/model is not configured; falling back unresolved proposals to UNKNOWN'
      );

      for (const proposalId of result.unresolvedProposalIds) {
        const fallback = await fallbackProposalToUnknownGroup({
          daoId: context.dao.id,
          proposalId,
          reason:
            'Proposal agent provider/model is not configured, so the harness fell back to UNKNOWN.',
          decisionSource: 'deterministic',
        });

        logger.info(
          {
            daoSlug: dao.slug,
            proposalId,
            fallback,
          },
          'Proposal was routed to the UNKNOWN fallback group'
        );
      }
      continue;
    }

    for (const proposalId of result.unresolvedProposalIds) {
      const sessionLogger = createAgentSessionLogger({
        logger,
        daoSlug: dao.slug,
        entityName: 'proposal',
        entityId: proposalId,
      });

      try {
        const output = await runPiAgent({
          extensionFactory: createProposalExtension({
            daoId: context.dao.id,
            proposalId,
            allowedCategoryIds,
            threshold: config.proposalConfidenceThreshold,
            budget: {
              startedAtMs: sessionLogger.startedAtMs,
              timeoutMs: config.pi.sessionTimeoutMs,
              maxQueryCalls: config.pi.maxQueryCalls,
            },
          }),
          activeToolNames: [
            'query_proposal_mapping_data',
            'propose_proposal_group_mapping',
            'decline_proposal_group_mapping',
          ],
          queryToolName: 'query_proposal_mapping_data',
          decisionToolNames: [
            'propose_proposal_group_mapping',
            'decline_proposal_group_mapping',
          ],
          systemPrompt: buildProposalSystemPrompt({
            confidenceThreshold: config.proposalConfidenceThreshold,
            maxQueryCalls: config.pi.maxQueryCalls,
            timeoutMs: config.pi.sessionTimeoutMs,
            daoId: context.dao.id,
            proposalId,
            schemaExport,
          }),
          prompt: buildProposalPrompt(),
          provider: config.pi.provider,
          model: config.pi.model,
          thinking: config.pi.thinking,
          configDir: config.pi.configDir,
          baseUrl: config.pi.baseUrl,
          apiKey: config.pi.apiKey,
          toolTransportMode: config.pi.toolTransport,
          contextWindow: config.pi.contextWindow,
          timeoutMs: config.pi.sessionTimeoutMs,
          decisionGraceMs: 60_000,
          maxQueryCalls: config.pi.maxQueryCalls,
          minQueryCallsBeforeDecision: 5,
          requireResolvedDecision: true,
          onEvent: sessionLogger.onEvent,
        });

        logger.info(
          {
            daoSlug: dao.slug,
            proposalId,
            output,
          },
          'Proposal agent session completed'
        );
      } catch (error) {
        const abortedResult =
          error instanceof PiAgentSessionAbortedError
            ? error.result
            : undefined;
        const level =
          error instanceof Error &&
          error.name === 'PiAgentSessionAbortedError' &&
          (error.message.includes('timed out') ||
            error.message.includes('query budget'))
            ? logger.warn.bind(logger)
            : logger.error.bind(logger);

        level(
          {
            daoSlug: dao.slug,
            proposalId,
            abortedResult,
            err: error,
          },
          'Proposal agent session did not finish cleanly'
        );

        try {
          const fallback = await fallbackProposalToUnknownGroup({
            daoId: context.dao.id,
            proposalId,
            reason:
              error instanceof Error
                ? `Proposal agent session did not finish cleanly and was routed to UNKNOWN. ${error.message}`
                : 'Proposal agent session did not finish cleanly and was routed to UNKNOWN.',
            evidenceIds: abortedResult?.toolCalls.map((toolCall) =>
              JSON.stringify(toolCall)
            ),
            decisionSource: 'deterministic',
          });

          logger.info(
            {
              daoSlug: dao.slug,
              proposalId,
              fallback,
            },
            'Proposal was routed to the UNKNOWN fallback group after agent failure'
          );
        } catch (fallbackError) {
          logger.error(
            {
              daoSlug: dao.slug,
              proposalId,
              err: fallbackError,
            },
            'Failed to route proposal to the UNKNOWN fallback group after agent failure'
          );
        }
      } finally {
        sessionLogger.stop();
      }
    }
  }
}

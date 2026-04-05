import type { Logger } from 'pino';
import type { MappingAgentConfig } from '../config';
import { PiAgentSessionAbortedError, runPiAgent } from '../runtime/pi-runner';
import { createAgentSessionLogger } from '../shared/agent-observability';
import { loadEnabledDaos } from '../shared/dao';
import { getPublicSchemaExport } from '../shared/schema-export';
import { createDelegateExtension } from './extension';
import { buildDelegatePrompt, buildDelegateSystemPrompt } from './prompt';
import { runDeterministicDelegateMappings } from './repository';

export async function runDelegateMappingWorker(
  config: MappingAgentConfig,
  logger: Logger
): Promise<void> {
  const daos = await loadEnabledDaos(config.enabledDaoSlugs);
  const schemaExport = await getPublicSchemaExport([
    'dao',
    'dao_discourse',
    'delegate',
    'discourse_user',
    'voter',
    'delegate_to_discourse_user',
    'delegate_to_voter',
    'vote',
    'voting_power_timeseries',
  ]);

  for (const dao of daos) {
    const allowedCategoryIds = config.daoCategoryFilters[dao.slug] ?? [];
    const { context, unresolvedCases, seedResults } =
      await runDeterministicDelegateMappings({
        daoSlug: dao.slug,
        confidenceThreshold: config.delegateConfidenceThreshold,
        allowedCategoryIds,
      });

    if (!context) {
      continue;
    }

    logger.info(
      {
        daoSlug: dao.slug,
        seedResults,
        unresolvedCases: unresolvedCases.length,
      },
      'Completed deterministic delegate mapping pass'
    );

    if (unresolvedCases.length === 0) {
      continue;
    }

    if (!config.pi.provider || !config.pi.model) {
      logger.warn(
        {
          daoSlug: dao.slug,
          unresolvedCases: unresolvedCases.length,
        },
        'Delegate agent is disabled because pi provider/model is not configured'
      );
      continue;
    }

    for (const currentCase of unresolvedCases) {
      const sessionLogger = createAgentSessionLogger({
        logger,
        daoSlug: dao.slug,
        entityName: 'delegate',
        entityId: currentCase.delegateId,
      });

      try {
        const output = await runPiAgent({
          extensionFactory: createDelegateExtension({
            daoId: context.dao.id,
            delegateId: currentCase.delegateId,
            allowedCategoryIds,
            threshold: config.delegateConfidenceThreshold,
            budget: {
              startedAtMs: sessionLogger.startedAtMs,
              timeoutMs: config.pi.sessionTimeoutMs,
              maxQueryCalls: config.pi.maxQueryCalls,
            },
          }),
          activeToolNames: [
            'query_delegate_mapping_data',
            'propose_delegate_mapping',
            'decline_delegate_mapping',
          ],
          queryToolName: 'query_delegate_mapping_data',
          decisionToolNames: [
            'propose_delegate_mapping',
            'decline_delegate_mapping',
          ],
          systemPrompt: buildDelegateSystemPrompt({
            confidenceThreshold: config.delegateConfidenceThreshold,
            maxQueryCalls: config.pi.maxQueryCalls,
            timeoutMs: config.pi.sessionTimeoutMs,
            daoId: context.dao.id,
            delegateId: currentCase.delegateId,
            schemaExport,
          }),
          prompt: buildDelegatePrompt(),
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
          minQueryCallsBeforeDecision: 10,
          requireResolvedDecision: true,
          onEvent: sessionLogger.onEvent,
        });

        logger.info(
          {
            daoSlug: dao.slug,
            delegateId: currentCase.delegateId,
            output,
          },
          'Delegate agent session completed'
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
            delegateId: currentCase.delegateId,
            abortedResult,
            err: error,
          },
          'Delegate agent session did not finish cleanly'
        );
      } finally {
        sessionLogger.stop();
      }
    }
  }
}

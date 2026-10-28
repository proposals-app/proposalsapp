import { db, ProposalState } from '@proposalsapp/db';
import type { NotificationType } from './notification-delivery';

const HOUR_MS = 60 * 60 * 1000;

// How far back to look for proposals that started voting and topics that were
// created. The window is deliberately much wider than the one-minute cron
// cadence so indexing lag, delayed voting starts and service restarts don't
// cause items to be skipped; `user_notification` (unique on user, type,
// target) guarantees each item is still emailed at most once per user.
export const DEFAULT_NEW_ITEM_LOOKBACK_HOURS = 24;

// Ending-proposal reminders are re-sendable after this cooldown, e.g. when a
// late-quorum vote extension moves the end of an on-chain proposal back into
// the reminder window days later.
export const ENDING_PROPOSAL_COOLDOWN_HOURS = 24;
export const ENDING_PROPOSAL_MINUTES = 60;

export function parseLookbackHours(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_NEW_ITEM_LOOKBACK_HOURS;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_NEW_ITEM_LOOKBACK_HOURS;
}

export const NEW_ITEM_LOOKBACK_HOURS = parseLookbackHours(
  process.env.NEW_ITEM_LOOKBACK_HOURS
);

export function newItemWindowStart(
  now: Date,
  lookbackHours = NEW_ITEM_LOOKBACK_HOURS
): Date {
  return new Date(now.getTime() - lookbackHours * HOUR_MS);
}

/**
 * Earliest `sent_at` that counts as "already sent". `undefined` means any
 * previous send counts: new-proposal and new-discussion emails are one-off,
 * whereas ending-proposal reminders use a cooldown.
 */
export function alreadySentCutoff(
  type: NotificationType,
  now: Date
): Date | undefined {
  if (type === 'ending_proposal') {
    return new Date(now.getTime() - ENDING_PROPOSAL_COOLDOWN_HOURS * HOUR_MS);
  }
  return undefined;
}

// Proposals become "new" when voting opens, which for Snapshot and on-chain
// governors can be minutes to days after the proposal was created.
export async function findNewProposals(daoId: string, now = new Date()) {
  return db
    .selectFrom('proposal')
    .selectAll()
    .where('daoId', '=', daoId)
    .where('proposalState', '=', ProposalState.ACTIVE)
    .where('markedSpam', '=', false)
    .where('startAt', '>=', newItemWindowStart(now))
    .execute();
}

export async function findEndingProposals(daoId: string, now = new Date()) {
  return db
    .selectFrom('proposal')
    .selectAll()
    .where('daoId', '=', daoId)
    .where('proposalState', '=', ProposalState.ACTIVE)
    .where('markedSpam', '=', false)
    .where(
      'endAt',
      '<=',
      new Date(now.getTime() + ENDING_PROPOSAL_MINUTES * 60 * 1000)
    )
    .where('endAt', '>', now)
    .execute();
}

export async function findNewDiscussionTopics(input: {
  daoDiscourseId: string;
  allowedCategories: readonly number[] | undefined;
  now?: Date;
}) {
  let query = db
    .selectFrom('discourseTopic')
    .innerJoin('discoursePost', (join) =>
      join
        .onRef('discoursePost.topicId', '=', 'discourseTopic.externalId')
        .on('discoursePost.postNumber', '=', 1)
        .onRef(
          'discoursePost.daoDiscourseId',
          '=',
          'discourseTopic.daoDiscourseId'
        )
    )
    .innerJoin('discourseUser', (join) =>
      join
        .onRef('discourseUser.externalId', '=', 'discoursePost.userId')
        .onRef(
          'discourseUser.daoDiscourseId',
          '=',
          'discoursePost.daoDiscourseId'
        )
    )
    .select([
      'discourseTopic.id',
      'discourseTopic.title',
      'discourseTopic.slug',
      'discourseTopic.externalId',
      'discourseUser.username',
      'discourseUser.avatarTemplate',
    ])
    .where('discourseTopic.daoDiscourseId', '=', input.daoDiscourseId)
    .where(
      'discourseTopic.createdAt',
      '>=',
      newItemWindowStart(input.now ?? new Date())
    );

  if (input.allowedCategories && input.allowedCategories.length > 0) {
    query = query.where('discourseTopic.categoryId', 'in', [
      ...input.allowedCategories,
    ]);
  }

  return query.execute();
}

export async function hasAlreadySent(input: {
  userId: string;
  targetId: string;
  type: NotificationType;
  daoId: string;
  now?: Date;
}): Promise<boolean> {
  let query = db
    .selectFrom('userNotification')
    .select('id')
    .where('userId', '=', input.userId)
    .where('targetId', '=', input.targetId)
    .where('type', '=', input.type)
    .where('daoId', '=', input.daoId);

  const cutoff = alreadySentCutoff(input.type, input.now ?? new Date());
  if (cutoff) {
    query = query.where('sentAt', '>=', cutoff);
  }

  return !!(await query.executeTakeFirst());
}

/**
 * Records that `type` was emailed to the user for `targetId`.
 * `user_notification` keeps one row per (user, type, target), so a repeat
 * send (an ending-proposal reminder after its cooldown) refreshes `sent_at`;
 * otherwise the cooldown would keep measuring from the first send and every
 * later cycle would consider the reminder unsent.
 */
export async function recordNotificationSent(input: {
  userId: string;
  targetId: string;
  type: NotificationType;
  daoId: string;
  sentAt?: Date;
}): Promise<void> {
  await db
    .insertInto('userNotification')
    .values({
      userId: input.userId,
      targetId: input.targetId,
      type: input.type,
      daoId: input.daoId,
      sentAt: input.sentAt ?? new Date(),
    })
    .onConflict((conflict) =>
      conflict.columns(['userId', 'type', 'targetId']).doUpdateSet((eb) => ({
        sentAt: eb.ref('excluded.sentAt'),
      }))
    )
    .execute();
}

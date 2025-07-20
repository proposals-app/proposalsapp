import type { AsyncReturnType } from '@/lib/utils';
import {
  daoSlugSchema,
  proposalIdSchema,
  voterAddressSchema,
} from '@/lib/validations';
import { db, type DiscourseUser, type Selectable } from '@proposalsapp/db';

export async function getProposalGovernor(proposalId: string) {
  // 'use cache';
  // cacheLife('days');

  proposalIdSchema.parse(proposalId);

  const proposal = await db.public
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['governorId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return null;
  }

  const daoIndexer = await db.public
    .selectFrom('daoGovernor')
    .where('id', '=', proposal.governorId)
    .selectAll()
    .executeTakeFirst();

  if (!daoIndexer) {
    console.warn(
      `DaoIndexer with id ${proposal.governorId} not found for proposal ${proposalId}.`
    );
    return null;
  }

  return daoIndexer;
}

export async function getNonVoters(proposalId: string) {
  // 'use cache';
  // cacheLife('minutes');

  const NON_VOTER_SELECT_LIMIT = 50000; //50k VP

  // Validate proposalId
  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return {
      totalNumberOfNonVoters: 0,
      totalVotingPower: 0,
      nonVoters: [],
    };
  }

  // Use the materialized view for much better performance
  const allNonVoters = await db.public
    .selectFrom('proposalNonVoters as pnv')
    .where('pnv.proposalId', '=', proposalId)
    .select([
      'pnv.voterAddress',
      'pnv.voterId',
      'pnv.votingPowerAtStart',
      'pnv.ens',
      'pnv.avatar',
      'pnv.currentVotingPower',
      'pnv.discourseUsername',
      'pnv.discourseAvatarTemplate as discourseAvatarUrl',
      'pnv.computedAvatar',
    ])
    .execute();

  let totalVotingPower = 0;
  const nonVoters = allNonVoters.map((nv) => {
    totalVotingPower += nv.votingPowerAtStart;
    return {
      voterAddress: nv.voterAddress,
      ens: nv.ens,
      avatar: nv.computedAvatar,
      votingPowerAtStart: nv.votingPowerAtStart,
      currentVotingPower: nv.currentVotingPower,
      discourseUsername: nv.discourseUsername,
      discourseAvatarUrl: nv.discourseAvatarUrl,
    };
  });

  return {
    totalNumberOfNonVoters: nonVoters.length,
    totalVotingPower,
    nonVoters: nonVoters.filter(
      (nv) => nv.votingPowerAtStart > NON_VOTER_SELECT_LIMIT
    ),
  };
}

export type NonVotersData = AsyncReturnType<typeof getNonVoters>;

export async function getVotesWithVoters(proposalId: string) {
  // 'use cache';
  // cacheLife('minutes');

  // Validate proposalId
  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return [];
  }

  // Use the materialized view for much better performance
  const votesWithVoters = await db.public
    .selectFrom('proposalVotesWithVoters as pvv')
    .where('pvv.proposalId', '=', proposalId)
    .select([
      'pvv.voteId as id',
      'pvv.choice',
      'pvv.createdAt',
      'pvv.proposalId',
      'pvv.reason',
      'pvv.voterAddress',
      'pvv.votingPower',
      'pvv.ens',
      'pvv.computedAvatar as avatar',
      'pvv.latestVotingPower',
      'pvv.discourseUsername',
      'pvv.discourseAvatarTemplate as discourseAvatarUrl',
    ])
    .orderBy('pvv.voterAddress', 'asc')
    .orderBy('pvv.createdAt', 'desc')
    .execute();

  return votesWithVoters.map((vote) => ({
    id: vote.id,
    choice: vote.choice,
    createdAt: vote.createdAt,
    proposalId: vote.proposalId,
    reason: vote.reason,
    voterAddress: vote.voterAddress,
    votingPower: vote.votingPower,
    ens: vote.ens || null,
    avatar: vote.avatar,
    latestVotingPower: vote.latestVotingPower ?? null,
    discourseUsername: vote.discourseUsername || null,
    discourseAvatarUrl: vote.discourseAvatarUrl || null,
  }));
}

export type DelegateInfo = {
  id: string | null | undefined;
  address: string;
  ens: string | null;
  profilePictureUrl: string | null;
} | null;

export async function getVoter(voterAddress: string): Promise<DelegateInfo> {
  // 'use cache';
  // cacheLife('hours');

  voterAddressSchema.parse(voterAddress);

  // Get the voter
  const voter = await db.public
    .selectFrom('voter')
    .where('address', '=', voterAddress)
    .selectAll()
    .executeTakeFirst();

  if (!voter) return null;

  // Fallback to address
  return {
    id: null,
    address: voter.address,
    ens: voter.ens,
    profilePictureUrl:
      voter.avatar ??
      `https://api.dicebear.com/9.x/pixel-art/png?seed=${voterAddress}`,
  };
}

export type DelegateVotingPower = {
  votingPowerAtVote: number;
  latestVotingPower: number;
  change: number | null;
};

export async function getDelegateVotingPower(
  voterAddress: string,
  daoSlug: string,
  proposalId: string
): Promise<DelegateVotingPower | null> {
  // 'use cache';
  // cacheLife('hours');

  // Validate all parameters
  try {
    voterAddressSchema.parse(voterAddress);
    daoSlugSchema.parse(daoSlug);
    proposalIdSchema.parse(proposalId);
  } catch {
    return null;
  }

  // Get the proposal to determine timestamps
  const proposal = await db.public
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!proposal) return null;

  // Get the dao
  const dao = await db.public
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  // Get the vote
  const vote = await db.public
    .selectFrom('vote')
    .where('voterAddress', '=', voterAddress)
    .where('proposalId', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!vote) return null;

  // Get the latest voting power
  const latestVotingPowerRecord = await db.public
    .selectFrom('votingPower')
    .where('voter', '=', voterAddress)
    .where('daoId', '=', dao.id)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .selectAll()
    .executeTakeFirst();

  const latestVotingPower = latestVotingPowerRecord?.votingPower ?? 0;
  const votingPowerAtVote = vote.votingPower;

  // Compute relative change
  let change: number | null = null;
  if (votingPowerAtVote !== 0) {
    const rawChange =
      ((latestVotingPower - votingPowerAtVote) / votingPowerAtVote) * 100;
    if (rawChange > 0.01 || rawChange < -0.01) {
      change = rawChange;
    }
  }

  return {
    votingPowerAtVote,
    latestVotingPower,
    change,
  };
}

export type VotesWithVoters = AsyncReturnType<typeof getVotesWithVoters>;

export async function getVotesWithVotersForProposals(proposalIds: string[]) {
  // 'use cache';
  // cacheLife('minutes');

  // Validate all proposalIds
  const validProposalIds = proposalIds.filter((id) => {
    try {
      proposalIdSchema.parse(id);
      return true;
    } catch {
      return false;
    }
  });

  if (validProposalIds.length === 0) {
    return [];
  }

  // 0. Fetch all proposals to get daoIds
  const proposals = await db.public
    .selectFrom('proposal')
    .where('id', 'in', validProposalIds)
    .select(['id', 'daoId'])
    .execute();

  if (proposals.length === 0) {
    return [];
  }

  // Get unique daoIds (should typically be just one for a group)
  const daoIds = [...new Set(proposals.map((p) => p.daoId))];

  // 1. Fetch all votes for all proposals in a single query
  const allVotes = await db.public
    .selectFrom('vote')
    .distinctOn(['proposalId', 'voterAddress'])
    .select([
      'id',
      'choice',
      'createdAt',
      'proposalId',
      'reason',
      'voterAddress',
      'votingPower',
    ])
    .where('proposalId', 'in', validProposalIds)
    .orderBy('proposalId', 'asc')
    .orderBy('voterAddress', 'asc')
    .orderBy('createdAt', 'desc')
    .execute();

  // 2. Get all unique voter addresses
  const voterAddresses = [
    ...new Set(allVotes.map((vote) => vote.voterAddress)),
  ];

  if (voterAddresses.length === 0) {
    return allVotes.map((vote) => ({
      ...vote,
      ens: null,
      avatar: `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: null,
      discourseUsername: null,
      discourseAvatarUrl: null,
      voterAddress: vote.voterAddress,
    }));
  }

  // 3. Fetch all voters in a single query
  const voters = await db.public
    .selectFrom('voter')
    .select(['id', 'address', 'ens', 'avatar'])
    .where('address', 'in', voterAddresses)
    .execute();

  const voterMap = new Map(voters.map((voter) => [voter.address, voter]));
  const voterIds = voters.map((v) => v.id);

  // 4. Fetch latest voting power for each voter across all DAOs
  const latestVotingPowers = await db.public
    .selectFrom('votingPower')
    .select(['voter', 'votingPower', 'daoId'])
    .where('voter', 'in', voterAddresses)
    .where('daoId', 'in', daoIds)
    .orderBy('voter', 'asc')
    .orderBy('daoId', 'asc')
    .orderBy('timestamp', 'desc')
    .distinctOn(['voter', 'daoId'])
    .execute();

  // Create a map for efficient latest voting power lookup by voter and daoId
  const latestVotingPowerMap = new Map<string, number>();
  latestVotingPowers.forEach((vp) => {
    const key = `${vp.voter}-${vp.daoId}`;
    latestVotingPowerMap.set(key, vp.votingPower);
  });

  // 5. Find delegate links for all voters across all DAOs
  const delegateToVoterLinks = await db.public
    .selectFrom('delegateToVoter as dtv')
    .innerJoin('delegate as d', 'd.id', 'dtv.delegateId')
    .where('dtv.voterId', 'in', voterIds)
    .where('d.daoId', 'in', daoIds)
    .orderBy('dtv.voterId', 'asc')
    .orderBy('d.daoId', 'asc')
    .orderBy('dtv.createdAt', 'desc')
    .distinctOn(['dtv.voterId', 'd.daoId'])
    .select(['dtv.voterId', 'dtv.delegateId', 'd.daoId'])
    .execute();

  const delegateIdByVoterAndDao = new Map<string, string>();
  delegateToVoterLinks.forEach((link) => {
    const key = `${link.voterId}-${link.daoId}`;
    delegateIdByVoterAndDao.set(key, link.delegateId);
  });
  const delegateIds = [
    ...new Set(delegateToVoterLinks.map((link) => link.delegateId)),
  ];

  // 6. Get all daoDiscourseIds for the DAOs
  const daoDiscourses = await db.public
    .selectFrom('daoDiscourse')
    .where('daoId', 'in', daoIds)
    .where('enabled', '=', true)
    .select(['id', 'daoId'])
    .execute();

  let discourseUserMap = new Map<string, Selectable<DiscourseUser>>();
  let discourseUserIdByDelegateId = new Map<string, string>();

  if (delegateIds.length > 0 && daoDiscourses.length > 0) {
    // 7. Find discourse user links for all delegates
    const delegateToDiscourseLinks = await db.public
      .selectFrom('delegateToDiscourseUser as dtdu')
      .where('dtdu.delegateId', 'in', delegateIds)
      .orderBy('dtdu.delegateId', 'asc')
      .orderBy('dtdu.createdAt', 'desc')
      .distinctOn('dtdu.delegateId')
      .select(['dtdu.delegateId', 'dtdu.discourseUserId'])
      .execute();

    discourseUserIdByDelegateId = new Map(
      delegateToDiscourseLinks.map((link) => [
        link.delegateId,
        link.discourseUserId,
      ])
    );

    const discourseUserIds = [
      ...new Set(delegateToDiscourseLinks.map((link) => link.discourseUserId)),
    ];

    // 8. Fetch all discourse users
    if (discourseUserIds.length > 0) {
      const discourseUsers = await db.public
        .selectFrom('discourseUser')
        .where('id', 'in', discourseUserIds)
        .where(
          'daoDiscourseId',
          'in',
          daoDiscourses.map((dd) => dd.id)
        )
        .selectAll()
        .execute();

      discourseUserMap = new Map(discourseUsers.map((du) => [du.id, du]));
    }
  }

  // 9. Map proposal to daoId for lookup
  const daoIdByProposalId = new Map(proposals.map((p) => [p.id, p.daoId]));

  // 10. Combine all data
  const votesWithVoters = allVotes.map((vote) => {
    const voter = voterMap.get(vote.voterAddress);
    const daoId = daoIdByProposalId.get(vote.proposalId);

    const latestVotingPower = daoId
      ? latestVotingPowerMap.get(`${vote.voterAddress}-${daoId}`)
      : undefined;

    let discourseUser: Selectable<DiscourseUser> | null = null;
    if (voter && daoId) {
      const delegateId = delegateIdByVoterAndDao.get(`${voter.id}-${daoId}`);
      if (delegateId) {
        const discourseUserId = discourseUserIdByDelegateId.get(delegateId);
        if (discourseUserId) {
          discourseUser = discourseUserMap.get(discourseUserId) || null;
        }
      }
    }

    return {
      ...vote,
      ens: voter?.ens || null,
      avatar:
        voter?.avatar ||
        discourseUser?.avatarTemplate ||
        `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: latestVotingPower ?? null,
      discourseUsername: discourseUser?.username || null,
      discourseAvatarUrl: discourseUser?.avatarTemplate || null,
      voterAddress: vote.voterAddress,
    };
  });

  return votesWithVoters;
}

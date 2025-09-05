import type { AsyncReturnType } from '@/lib/utils';
import { cache } from 'react';
import {
  daoSlugSchema,
  proposalIdSchema,
  voterAddressSchema,
} from '@/lib/validations';
import {
  db,
  type DiscourseUser,
  type Selectable,
  type Vote,
} from '@proposalsapp/db';

export const EXCLUSION_ADDRESS = '0x00000000000000000000000000000000000A4B86';

export async function getProposalGovernor(proposalId: string) {
  proposalIdSchema.parse(proposalId);

  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['governorId'])
    .executeTakeFirst();

  if (!proposal) return null;

  const daoIndexer = await db
    .selectFrom('daoGovernor')
    .where('id', '=', proposal.governorId)
    .selectAll()
    .executeTakeFirst();

  if (!daoIndexer) return null;

  return daoIndexer;
}

export async function getTotalDelegatedVpAtStart(
  proposalId: string
): Promise<number> {
  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return 0;
  }

  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['daoId', 'startAt'])
    .executeTakeFirst();

  if (!proposal) return 0;

  // Join historical voting power with current voters to only count tokens still available for voting
  const historicalPowers = await db
    .selectFrom('votingPowerTimeseries as vp')
    .innerJoin('votingPowerLatest as latest', (join) =>
      join
        .onRef('latest.voter', '=', 'vp.voter')
        .on('latest.daoId', '=', proposal.daoId)
        .on('latest.votingPower', '>', 0)
        .on('latest.voter', '!=', EXCLUSION_ADDRESS)
    )
    .where('vp.daoId', '=', proposal.daoId)
    .where('vp.votingPower', '>', 0)
    .where('vp.timestamp', '<=', proposal.startAt)
    .orderBy('vp.voter', 'asc')
    .orderBy('vp.timestamp', 'desc')
    .distinctOn(['vp.voter'])
    .select(['vp.votingPower'])
    .execute();

  if (historicalPowers.length === 0) return 0;

  return historicalPowers.reduce((sum, r) => sum + (r.votingPower || 0), 0);
}

export async function getNonVoters(proposalId: string) {
  const NON_VOTER_SELECT_LIMIT = 50000;

  type DelegateToVoterLink = {
    voterId: string;
    delegateId: string;
  };
  type DelegateToDiscourseLink = {
    delegateId: string;
    discourseUserId: string;
  };

  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return {
      totalNumberOfNonVoters: 0,
      totalVotingPower: 0,
      nonVoters: [],
    };
  }
  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'governorId', 'daoId', 'startAt', 'endAt'])
    .executeTakeFirst();

  if (!proposal) {
    return { nonVoters: [], totalNumberOfNonVoters: 0, totalVotingPower: 0 };
  }
  const { daoId, startAt } = proposal;

  const votedAddressesSet = new Set(
    (
      await db
        .selectFrom('vote')
        .where('proposalId', '=', proposalId)
        .select('voterAddress')
        .distinct()
        .execute()
    ).map((v) => v.voterAddress)
  );

  const eligibleVoters = await db
    .selectFrom('votingPowerTimeseries as vp')
    .innerJoin('voter as v', 'v.address', 'vp.voter')
    .where('vp.daoId', '=', daoId)
    .where('vp.votingPower', '>', 0)
    .where('vp.timestamp', '<=', startAt)
    .orderBy('vp.voter', 'asc')
    .orderBy('vp.timestamp', 'desc')
    .distinctOn(['vp.voter'])
    .select([
      'vp.voter',
      'vp.votingPower as votingPowerAtStart',
      'v.id as voterId',
      'v.ens',
      'v.avatar',
    ])
    .execute();

  if (eligibleVoters.length === 0) {
    return { nonVoters: [], totalNumberOfNonVoters: 0, totalVotingPower: 0 };
  }

  const eligibleVoterAddresses = eligibleVoters.map((v) => v.voter);
  const eligibleVoterIds = eligibleVoters.map((v) => v.voterId);

  // Process current voting power in chunks to handle large datasets
  const CHUNK_SIZE = 10000;
  const currentPowerMap = new Map<string, number>();

  if (eligibleVoterAddresses.length <= CHUNK_SIZE) {
    const currentPowers = await db
      .selectFrom('votingPowerLatest')
      .where('daoId', '=', daoId)
      .where('voter', 'in', eligibleVoterAddresses)
      .select(['voter', 'votingPower'])
      .execute();
    currentPowers.forEach((cp) => {
      currentPowerMap.set(cp.voter, cp.votingPower);
    });
  } else {
    for (let i = 0; i < eligibleVoterAddresses.length; i += CHUNK_SIZE) {
      const chunk = eligibleVoterAddresses.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      const chunkPowers = await db
        .selectFrom('votingPowerLatest')
        .where('daoId', '=', daoId)
        .where('voter', 'in', chunk)
        .select(['voter', 'votingPower'])
        .execute();
      chunkPowers.forEach((cp) => {
        currentPowerMap.set(cp.voter, cp.votingPower);
      });
    }
  }

  // Link voters to discourse users for profile information
  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', daoId)
    .select('id')
    .executeTakeFirst();

  let delegateIdByVoterId = new Map<string, string>();
  let discourseUserIdByDelegateId = new Map<string, string>();
  let discourseUserMap = new Map<string, Selectable<DiscourseUser>>();
  let allDelegateIds: string[] = [];
  let allDiscourseUserIds: string[] = [];
  if (daoDiscourse && eligibleVoterIds.length > 0) {
    const daoDiscourseId = daoDiscourse.id;

    // Process delegate links in chunks to avoid parameter limits
    const allDelegateToVoterLinks: DelegateToVoterLink[] = [];
    for (let i = 0; i < eligibleVoterIds.length; i += CHUNK_SIZE) {
      const chunk = eligibleVoterIds.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;

      const chunkLinks = await db
        .selectFrom('delegateToVoter as dtv')
        .innerJoin('delegate as d', 'd.id', 'dtv.delegateId')
        .where('dtv.voterId', 'in', chunk)
        .where('d.daoId', '=', daoId)
        .orderBy('dtv.voterId', 'asc')
        .orderBy('dtv.createdAt', 'desc')
        .distinctOn('dtv.voterId')
        .select(['dtv.voterId', 'dtv.delegateId'])
        .execute();
      allDelegateToVoterLinks.push(...chunkLinks);
    }

    delegateIdByVoterId = new Map(
      allDelegateToVoterLinks.map((link) => [link.voterId, link.delegateId])
    );
    allDelegateIds = [
      ...new Set(allDelegateToVoterLinks.map((link) => link.delegateId)),
    ];

    if (allDelegateIds.length > 0) {
      const allDelegateToDiscourseLinks: DelegateToDiscourseLink[] = [];
      for (let i = 0; i < allDelegateIds.length; i += CHUNK_SIZE) {
        const chunk = allDelegateIds.slice(i, i + CHUNK_SIZE);
        if (chunk.length === 0) continue;

        const chunkLinks = await db
          .selectFrom('delegateToDiscourseUser as dtdu')
          .where('dtdu.delegateId', 'in', chunk)
          .orderBy('dtdu.delegateId', 'asc')
          .orderBy('dtdu.createdAt', 'desc')
          .distinctOn('dtdu.delegateId')
          .select(['dtdu.delegateId', 'dtdu.discourseUserId'])
          .execute();
        allDelegateToDiscourseLinks.push(...chunkLinks);
      }

      discourseUserIdByDelegateId = new Map(
        allDelegateToDiscourseLinks.map((link) => [
          link.delegateId,
          link.discourseUserId,
        ])
      );
      allDiscourseUserIds = [
        ...new Set(
          allDelegateToDiscourseLinks.map((link) => link.discourseUserId)
        ),
      ];

      if (allDiscourseUserIds.length > 0) {
        const allDiscourseUsers: Selectable<DiscourseUser>[] = [];
        for (let i = 0; i < allDiscourseUserIds.length; i += CHUNK_SIZE) {
          const chunk = allDiscourseUserIds.slice(i, i + CHUNK_SIZE);
          if (chunk.length === 0) continue;

          const chunkUsers = await db
            .selectFrom('discourseUser')
            .where('id', 'in', chunk)
            .where('daoDiscourseId', '=', daoDiscourseId)
            .selectAll()
            .execute();
          allDiscourseUsers.push(...chunkUsers);
        }
        discourseUserMap = new Map(allDiscourseUsers.map((du) => [du.id, du]));
      }
    }
  }

  let totalVotingPower = 0;
  const nonVoters = eligibleVoters
    .filter((v) => !votedAddressesSet.has(v.voter))
    .map((voter) => {
      const currentVotingPower = currentPowerMap.get(voter.voter) ?? 0;
      totalVotingPower += voter.votingPowerAtStart;

      let discourseUser: Selectable<DiscourseUser> | null = null;
      const delegateId = delegateIdByVoterId.get(voter.voterId);
      if (delegateId) {
        const discourseUserId = discourseUserIdByDelegateId.get(delegateId);
        if (discourseUserId) {
          discourseUser = discourseUserMap.get(discourseUserId) || null;
        }
      }

      return {
        voterAddress: voter.voter,
        ens: voter.ens,
        avatar:
          voter.avatar ||
          discourseUser?.avatarTemplate ||
          `https://api.dicebear.com/9.x/pixel-art/png?seed=${voter.voter}`,
        votingPowerAtStart: voter.votingPowerAtStart,
        currentVotingPower,
        discourseUsername: discourseUser?.username || null,
        discourseAvatarUrl: discourseUser?.avatarTemplate || null,
      };
    })
    .filter((voter) => voter.votingPowerAtStart > 0);

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
  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return [];
  }
  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'daoId'])
    .executeTakeFirst();

  if (!proposal) return [];
  const { daoId } = proposal;

  const votesWithAllData = await db
    .selectFrom('vote')
    .innerJoin('voter', 'voter.address', 'vote.voterAddress')
    .leftJoin('votingPowerLatest as latestVp', (join) =>
      join
        .onRef('latestVp.voter', '=', 'vote.voterAddress')
        .on('latestVp.daoId', '=', daoId)
    )
    .distinctOn('vote.voterAddress')
    .select([
      'vote.id',
      'vote.choice',
      'vote.createdAt',
      'vote.proposalId',
      'vote.reason',
      'vote.voterAddress',
      'vote.votingPower',
      'voter.id as voterId',
      'voter.ens',
      'voter.avatar',
      'latestVp.votingPower as latestVotingPower',
    ])
    .where('vote.proposalId', '=', proposalId)
    .orderBy('vote.voterAddress', 'asc')
    .orderBy('vote.createdAt', 'desc')
    .execute();

  if (votesWithAllData.length === 0) {
    return [];
  }

  const voterIds = votesWithAllData.map((v) => v.voterId);
  const delegateToVoterLinks = await db
    .selectFrom('delegateToVoter as dtv')
    .innerJoin('delegate as d', 'd.id', 'dtv.delegateId')
    .where('dtv.voterId', 'in', voterIds)
    .where('d.daoId', '=', daoId)
    .orderBy('dtv.voterId', 'asc')
    .orderBy('dtv.createdAt', 'desc')
    .distinctOn('dtv.voterId')
    .select(['dtv.voterId', 'dtv.delegateId'])
    .execute();

  const delegateIdByVoterId = new Map(
    delegateToVoterLinks.map((link) => [link.voterId, link.delegateId])
  );
  const delegateIds = delegateToVoterLinks.map((link) => link.delegateId);

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', daoId)
    .select('id')
    .executeTakeFirst();

  let discourseUserMap = new Map<string, Selectable<DiscourseUser>>();
  let discourseUserIdByDelegateId = new Map<string, string>();
  if (delegateIds.length > 0 && daoDiscourse) {
    const daoDiscourseId = daoDiscourse.id;

    const delegateToDiscourseLinks = await db
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

    const discourseUserIds = delegateToDiscourseLinks.map(
      (link) => link.discourseUserId
    );

    if (discourseUserIds.length > 0) {
      const discourseUsers = await db
        .selectFrom('discourseUser')
        .where('id', 'in', discourseUserIds)
        .where('daoDiscourseId', '=', daoDiscourseId)
        .selectAll()
        .execute();

      discourseUserMap = new Map(discourseUsers.map((du) => [du.id, du]));
    }
  }

  const votesWithVoters = votesWithAllData.map((vote) => {
    let discourseUser: Selectable<DiscourseUser> | null = null;
    const delegateId = delegateIdByVoterId.get(vote.voterId);
    if (delegateId) {
      const discourseUserId = discourseUserIdByDelegateId.get(delegateId);
      if (discourseUserId) {
        discourseUser = discourseUserMap.get(discourseUserId) || null;
      }
    }

    return {
      id: vote.id,
      choice: vote.choice,
      createdAt: vote.createdAt,
      proposalId: vote.proposalId,
      reason: vote.reason,
      voterAddress: vote.voterAddress,
      votingPower: vote.votingPower,
      ens: vote.ens || null,
      avatar:
        vote.avatar ||
        discourseUser?.avatarTemplate ||
        `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: vote.latestVotingPower ?? null,
      discourseUsername: discourseUser?.username || null,
      discourseAvatarUrl: discourseUser?.avatarTemplate || null,
    };
  });

  return votesWithVoters;
}

export type DelegateInfo = {
  id: string | null | undefined;
  address: string;
  ens: string | null;
  profilePictureUrl: string | null;
} | null;

export async function getVoter(voterAddress: string): Promise<DelegateInfo> {
  voterAddressSchema.parse(voterAddress);
  const voter = await db
    .selectFrom('voter')
    .where('address', '=', voterAddress)
    .selectAll()
    .executeTakeFirst();

  if (!voter) return null;

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
  try {
    voterAddressSchema.parse(voterAddress);
    daoSlugSchema.parse(daoSlug);
    proposalIdSchema.parse(proposalId);
  } catch {
    return null;
  }
  const proposal = await db
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!proposal) return null;

  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  const vote = await db
    .selectFrom('vote')
    .where('voterAddress', '=', voterAddress)
    .where('proposalId', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!vote) return null;

  const latestVotingPowerRecord = await db
    .selectFrom('votingPowerLatest')
    .where('voter', '=', voterAddress)
    .where('daoId', '=', dao.id)
    .selectAll()
    .executeTakeFirst();

  const latestVotingPower = latestVotingPowerRecord?.votingPower ?? 0;
  const votingPowerAtVote = vote.votingPower;

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

  const proposals = await db
    .selectFrom('proposal')
    .where('id', 'in', validProposalIds)
    .select(['id', 'daoId'])
    .execute();

  if (proposals.length === 0) {
    return [];
  }

  const daoIds = [...new Set(proposals.map((p) => p.daoId))];
  const allVotes = await db
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

  const voters = await db
    .selectFrom('voter')
    .select(['id', 'address', 'ens', 'avatar'])
    .where('address', 'in', voterAddresses)
    .execute();

  const voterMap = new Map(voters.map((voter) => [voter.address, voter]));
  const voterIds = voters.map((v) => v.id);

  const latestVotingPowers = await db
    .selectFrom('votingPowerLatest')
    .select(['voter', 'votingPower', 'daoId'])
    .where('voter', 'in', voterAddresses)
    .where('daoId', 'in', daoIds)
    .execute();

  const latestVotingPowerMap = new Map<string, number>();
  latestVotingPowers.forEach((vp) => {
    const key = `${vp.voter}-${vp.daoId}`;
    latestVotingPowerMap.set(key, vp.votingPower);
  });

  const delegateToVoterLinks = await db
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

  const daoDiscourses = await db
    .selectFrom('daoDiscourse')
    .where('daoId', 'in', daoIds)
    .select(['id', 'daoId'])
    .execute();

  let discourseUserMap = new Map<string, Selectable<DiscourseUser>>();
  let discourseUserIdByDelegateId = new Map<string, string>();

  if (delegateIds.length > 0 && daoDiscourses.length > 0) {
    const delegateToDiscourseLinks = await db
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

    if (discourseUserIds.length > 0) {
      const discourseUsers = await db
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

  const daoIdByProposalId = new Map(proposals.map((p) => [p.id, p.daoId]));
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

export const getVotesWithVotersCached = cache(getVotesWithVoters);
export const getTotalDelegatedVpAtStartCached = cache(
  getTotalDelegatedVpAtStart
);
export const getProposalGovernorCached = cache(getProposalGovernor);
export const getVoterCached = cache(getVoter);

export async function getVotesMinimal(
  proposalId: string
): Promise<
  Pick<
    Selectable<Vote>,
    | 'id'
    | 'choice'
    | 'createdAt'
    | 'proposalId'
    | 'reason'
    | 'voterAddress'
    | 'votingPower'
  >[]
> {
  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return [] as Pick<
      Selectable<Vote>,
      | 'id'
      | 'choice'
      | 'createdAt'
      | 'proposalId'
      | 'reason'
      | 'voterAddress'
      | 'votingPower'
    >[];
  }

  const votes = await db
    .selectFrom('vote')
    .where('proposalId', '=', proposalId)
    .distinctOn(['voterAddress'])
    .select([
      'id',
      'choice',
      'createdAt',
      'proposalId',
      'reason',
      'voterAddress',
      'votingPower',
    ])
    .orderBy('voterAddress', 'asc')
    .orderBy('createdAt', 'desc')
    .execute();

  return votes.map((v) => ({
    ...v,
    createdAt: (v.createdAt instanceof Date
      ? v.createdAt
      : new Date(v.createdAt as unknown as string)) as Date,
  }));
}

export const getVotesMinimalCached = cache(getVotesMinimal);

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

  type DelegateToVoterLink = {
    voterId: string;
    delegateId: string;
  };
  type DelegateToDiscourseLink = {
    delegateId: string;
    discourseUserId: string;
  };

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

  // 0. Fetch proposal
  const proposal = await db.public
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'governorId', 'daoId', 'startAt', 'endAt'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(
      `Proposal with id ${proposalId} not found for non-voters query.`
    );
    return { nonVoters: [], totalNumberOfNonVoters: 0, totalVotingPower: 0 };
  }
  const { daoId, startAt } = proposal;

  // 1. Get addresses that *did* vote
  const votedAddressesSet = new Set(
    (
      await db.public
        .selectFrom('vote')
        .where('proposalId', '=', proposalId)
        .select('voterAddress')
        .distinct()
        .execute()
    ).map((v) => v.voterAddress)
  );

  // 2. Get all potentially eligible voters at proposal start
  const eligibleVoters = await db.public
    .selectFrom('votingPower as vp')
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
    console.log(`No eligible voters found for proposal ${proposalId}`);
    return { nonVoters: [], totalNumberOfNonVoters: 0, totalVotingPower: 0 };
  }

  const eligibleVoterAddresses = eligibleVoters.map((v) => v.voter);
  const eligibleVoterIds = eligibleVoters.map((v) => v.voterId);

  // 3. Get the *current* (latest) voting power for all eligible voters
  // Use a more efficient approach with a single query when possible
  const CHUNK_SIZE = 5000; // Increased chunk size for better performance
  const currentPowerMap = new Map<string, number>();

  if (eligibleVoterAddresses.length <= CHUNK_SIZE) {
    // Single query for smaller datasets
    const currentPowers = await db.public
      .selectFrom('votingPower')
      .where('daoId', '=', daoId)
      .where('voter', 'in', eligibleVoterAddresses)
      .select(['voter', 'votingPower'])
      .distinctOn('voter')
      .orderBy('voter', 'asc')
      .orderBy('timestamp', 'desc')
      .execute();
    currentPowers.forEach((cp) => {
      currentPowerMap.set(cp.voter, cp.votingPower);
    });
  } else {
    // Chunked processing for large datasets
    for (let i = 0; i < eligibleVoterAddresses.length; i += CHUNK_SIZE) {
      const chunk = eligibleVoterAddresses.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      const chunkPowers = await db.public
        .selectFrom('votingPower')
        .where('daoId', '=', daoId)
        .where('voter', 'in', chunk)
        .select(['voter', 'votingPower'])
        .distinctOn('voter')
        .orderBy('voter', 'asc')
        .orderBy('timestamp', 'desc')
        .execute();
      chunkPowers.forEach((cp) => {
        currentPowerMap.set(cp.voter, cp.votingPower);
      });
    }
  }

  // --- Steps to fetch Discourse User Info (CHUNKED) ---

  // 4. Get the daoDiscourseId for the current DAO
  const daoDiscourse = await db.public
    .selectFrom('daoDiscourse')
    .where('daoId', '=', daoId)
    .where('enabled', '=', true)
    .select('id')
    .executeTakeFirst();

  // Initialize maps and lists needed later
  let delegateIdByVoterId = new Map<string, string>();
  let discourseUserIdByDelegateId = new Map<string, string>();
  let discourseUserMap = new Map<string, Selectable<DiscourseUser>>();
  let allDelegateIds: string[] = [];
  let allDiscourseUserIds: string[] = [];

  // Only proceed if there's a discourse setup for the DAO
  if (daoDiscourse && eligibleVoterIds.length > 0) {
    const daoDiscourseId = daoDiscourse.id;

    // 5. Find delegate links for eligible voters (CHUNKED)
    const allDelegateToVoterLinks: DelegateToVoterLink[] = [];
    for (let i = 0; i < eligibleVoterIds.length; i += CHUNK_SIZE) {
      const chunk = eligibleVoterIds.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;

      const chunkLinks = await db.public
        .selectFrom('delegateToVoter as dtv')
        .innerJoin('delegate as d', 'd.id', 'dtv.delegateId')
        .where('dtv.voterId', 'in', chunk) // Use chunk here
        .where('d.daoId', '=', daoId)
        .orderBy('dtv.voterId', 'asc')
        .orderBy('dtv.createdAt', 'desc')
        .distinctOn('dtv.voterId')
        .select(['dtv.voterId', 'dtv.delegateId'])
        .execute();
      allDelegateToVoterLinks.push(...chunkLinks);
    }

    // Populate map and list *after* chunking
    delegateIdByVoterId = new Map(
      allDelegateToVoterLinks.map((link) => [link.voterId, link.delegateId])
    );
    // Get unique delegate IDs
    allDelegateIds = [
      ...new Set(allDelegateToVoterLinks.map((link) => link.delegateId)),
    ];

    // Only proceed if there are linked delegates
    if (allDelegateIds.length > 0) {
      // 6. Find Discourse user links for delegates (CHUNKED)
      const allDelegateToDiscourseLinks: DelegateToDiscourseLink[] = [];
      for (let i = 0; i < allDelegateIds.length; i += CHUNK_SIZE) {
        const chunk = allDelegateIds.slice(i, i + CHUNK_SIZE);
        if (chunk.length === 0) continue;

        const chunkLinks = await db.public
          .selectFrom('delegateToDiscourseUser as dtdu')
          .where('dtdu.delegateId', 'in', chunk) // Use chunk here
          .orderBy('dtdu.delegateId', 'asc')
          .orderBy('dtdu.createdAt', 'desc')
          .distinctOn('dtdu.delegateId')
          .select(['dtdu.delegateId', 'dtdu.discourseUserId'])
          .execute();
        allDelegateToDiscourseLinks.push(...chunkLinks);
      }

      // Populate map and list *after* chunking
      discourseUserIdByDelegateId = new Map(
        allDelegateToDiscourseLinks.map((link) => [
          link.delegateId,
          link.discourseUserId,
        ])
      );
      // Get unique discourse user IDs
      allDiscourseUserIds = [
        ...new Set(
          allDelegateToDiscourseLinks.map((link) => link.discourseUserId)
        ),
      ];

      // 7. Fetch Discourse User details (CHUNKED)
      if (allDiscourseUserIds.length > 0) {
        const allDiscourseUsers: Selectable<DiscourseUser>[] = [];
        for (let i = 0; i < allDiscourseUserIds.length; i += CHUNK_SIZE) {
          const chunk = allDiscourseUserIds.slice(i, i + CHUNK_SIZE);
          if (chunk.length === 0) continue;

          const chunkUsers = await db.public
            .selectFrom('discourseUser')
            .where('id', 'in', chunk) // Use chunk here
            .where('daoDiscourseId', '=', daoDiscourseId)
            .selectAll()
            .execute();
          allDiscourseUsers.push(...chunkUsers);
        }
        // Populate map *after* chunking
        discourseUserMap = new Map(allDiscourseUsers.map((du) => [du.id, du]));
      }
    }
  }

  // --- Combine and Filter ---

  let totalVotingPower = 0;
  // 8. Filter eligible voters who didn't vote and map to the final structure
  const nonVoters = eligibleVoters
    .filter((v) => !votedAddressesSet.has(v.voter))
    .map((voter) => {
      const currentVotingPower = currentPowerMap.get(voter.voter) ?? 0;
      totalVotingPower += voter.votingPowerAtStart;

      // Find associated discourse user, if any (using the maps populated after chunking)
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
  // 'use cache';
  // cacheLife('minutes');

  // Validate proposalId
  try {
    proposalIdSchema.parse(proposalId);
  } catch {
    return [];
  }

  // 0. Fetch proposal to get daoId
  const proposal = await db.public
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'daoId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return []; // Return empty array if proposal doesn't exist
  }
  const { daoId } = proposal;

  // Optimized single query with all necessary joins
  const votesWithAllData = await db.public
    .selectFrom('vote')
    .innerJoin('voter', 'voter.address', 'vote.voterAddress')
    .leftJoin(
      db.public
        .selectFrom('votingPower')
        .select(['voter', 'votingPower', 'daoId'])
        .where('daoId', '=', daoId)
        .distinctOn('voter')
        .orderBy('voter', 'asc')
        .orderBy('timestamp', 'desc')
        .as('latestVp'),
      'latestVp.voter',
      'vote.voterAddress'
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

  // Extract voter IDs for delegate lookup
  const voterIds = votesWithAllData.map((v) => v.voterId);

  // Latest voting power is already included in the join

  // --- New Steps for Discourse User ---

  // 5. Find the delegate link for each voter (most recent verified link)
  const delegateToVoterLinks = await db.public
    .selectFrom('delegateToVoter as dtv')
    .innerJoin('delegate as d', 'd.id', 'dtv.delegateId')
    .where('dtv.voterId', 'in', voterIds)
    .where('d.daoId', '=', daoId) // Ensure delegate belongs to the DAO
    .orderBy('dtv.voterId', 'asc')
    .orderBy('dtv.createdAt', 'desc') // Or periodStart/End depending on desired logic
    .distinctOn('dtv.voterId')
    .select(['dtv.voterId', 'dtv.delegateId'])
    .execute();

  const delegateIdByVoterId = new Map(
    delegateToVoterLinks.map((link) => [link.voterId, link.delegateId])
  );
  const delegateIds = delegateToVoterLinks.map((link) => link.delegateId);

  // 6. Get the daoDiscourseId for the current DAO
  const daoDiscourse = await db.public
    .selectFrom('daoDiscourse')
    .where('daoId', '=', daoId)
    .where('enabled', '=', true)
    .select('id')
    .executeTakeFirst();

  // Initialize maps needed later
  let discourseUserMap = new Map<string, Selectable<DiscourseUser>>();
  // *** Declare the map that was missing population ***
  let discourseUserIdByDelegateId = new Map<string, string>();

  // Only proceed if there are delegates and a discourse setup for the DAO
  if (delegateIds.length > 0 && daoDiscourse) {
    const daoDiscourseId = daoDiscourse.id;

    // 7. Find the discourse user link for each delegate (most recent verified link)
    const delegateToDiscourseLinks = await db.public
      .selectFrom('delegateToDiscourseUser as dtdu')
      .where('dtdu.delegateId', 'in', delegateIds)
      // .where('dtdu.verified', '=', true) // Optional: only consider verified links
      .orderBy('dtdu.delegateId', 'asc')
      .orderBy('dtdu.createdAt', 'desc') // Or periodStart/End
      .distinctOn('dtdu.delegateId')
      .select(['dtdu.delegateId', 'dtdu.discourseUserId'])
      .execute();

    // *** FIX: Populate the map here ***
    discourseUserIdByDelegateId = new Map(
      delegateToDiscourseLinks.map((link) => [
        link.delegateId,
        link.discourseUserId,
      ])
    );

    const discourseUserIds = delegateToDiscourseLinks.map(
      (link) => link.discourseUserId
    );

    // 8. Fetch the actual Discourse User details for the linked users
    if (discourseUserIds.length > 0) {
      const discourseUsers = await db.public
        .selectFrom('discourseUser')
        .where('id', 'in', discourseUserIds)
        .where('daoDiscourseId', '=', daoDiscourseId) // Ensure the discourse user belongs to the correct discourse instance
        .selectAll()
        .execute();

      // Map discourse users by their ID for lookup
      discourseUserMap = new Map(discourseUsers.map((du) => [du.id, du]));
    }
  }

  // --- Combine all data ---

  // 9. Combine vote data with voter, voting power, and discourse user info
  const votesWithVoters = votesWithAllData.map((vote) => {
    // Find the discourse user
    let discourseUser: Selectable<DiscourseUser> | null = null;
    const delegateId = delegateIdByVoterId.get(vote.voterId);
    if (delegateId) {
      const discourseUserId = discourseUserIdByDelegateId.get(delegateId);
      if (discourseUserId) {
        discourseUser = discourseUserMap.get(discourseUserId) || null;
      }
    }

    // Construct the final object for this vote
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

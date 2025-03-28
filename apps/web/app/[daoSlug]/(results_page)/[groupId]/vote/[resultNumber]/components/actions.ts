import { AsyncReturnType } from '@/lib/utils';
import {
  daoSlugSchema,
  proposalIdSchema,
  voterAddressSchema,
} from '@/lib/validations';
import { dbIndexer, DiscourseUser, Selectable } from '@proposalsapp/db-indexer';
import { cacheLife } from 'next/dist/server/use-cache/cache-life';

export async function getProposalGovernor(proposalId: string) {
  'use cache';
  cacheLife('days');

  proposalIdSchema.parse(proposalId);

  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['governorId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return null;
  }

  const daoIndexer = await dbIndexer
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
  'use cache';
  cacheLife('minutes');

  proposalIdSchema.parse(proposalId);

  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'governorId', 'daoId', 'startAt', 'endAt'])
    .executeTakeFirst();

  if (!proposal) {
    return [];
  }

  const votedAddressesSet = new Set(
    (
      await dbIndexer
        .selectFrom('vote')
        .where('proposalId', '=', proposalId)
        .select('voterAddress')
        .distinct()
        .execute()
    ).map((v) => v.voterAddress)
  );

  const eligibleVoters = await dbIndexer
    .selectFrom('votingPower as vp')
    .innerJoin('voter as v', 'v.address', 'vp.voter')
    .where('vp.daoId', '=', proposal.daoId)
    .where('vp.votingPower', '>', 0)
    .where('vp.timestamp', '<=', proposal.startAt)
    .orderBy('vp.voter', 'asc')
    .orderBy('vp.timestamp', 'desc')
    .distinctOn(['vp.voter'])
    .select([
      'vp.voter',
      'vp.votingPower as votingPowerAtStart',
      'v.ens',
      'v.avatar',
    ])
    .execute();
  if (eligibleVoters.length === 0) return [];

  // Process voters in chunks to avoid parameter limit issues
  const CHUNK_SIZE = 1000;
  const voters = eligibleVoters.map((v) => v.voter);
  const currentPowerMap = new Map();

  // Process in chunks
  for (let i = 0; i < voters.length; i += CHUNK_SIZE) {
    const chunk = voters.slice(i, i + CHUNK_SIZE);

    const chunkPowers = await dbIndexer
      .selectFrom('votingPower')
      .where('daoId', '=', proposal.daoId)
      .where('voter', 'in', chunk)
      .select((eb) => [
        'voter',
        eb.fn
          .max('votingPower')
          .over((ob) => ob.partitionBy('voter'))
          .as('currentVotingPower'),
      ])
      .groupBy('voter')
      .groupBy('votingPower')
      .execute();

    // Add results to our map
    chunkPowers.forEach((cp) => {
      currentPowerMap.set(cp.voter, cp.currentVotingPower);
    });
  }

  const nonVoters = eligibleVoters
    .filter((v) => !votedAddressesSet.has(v.voter))
    .map((voter) => {
      const currentVotingPower = currentPowerMap.get(voter.voter) ?? 0;

      return {
        voterAddress: voter.voter,
        ens: voter.ens,
        avatar:
          voter.avatar ||
          `https://api.dicebear.com/9.x/pixel-art/png?seed=${voter.voter}`,
        votingPowerAtStart: voter.votingPowerAtStart,
        currentVotingPower,
      };
    })
    .filter((voter) => voter.votingPowerAtStart > 0);

  return nonVoters;
}

export type NonVotersData = AsyncReturnType<typeof getNonVoters>;

export async function getVotesWithVoters(proposalId: string) {
  'use cache';
  cacheLife('minutes');

  proposalIdSchema.parse(proposalId);

  // 0. Fetch proposal to get daoId
  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .select(['id', 'daoId'])
    .executeTakeFirst();

  if (!proposal) {
    console.warn(`Proposal with id ${proposalId} not found.`);
    return []; // Return empty array if proposal doesn't exist
  }
  const { daoId } = proposal;

  // 1. Fetch votes, including only the necessary voter address
  const votes = await dbIndexer
    .selectFrom('vote')
    .select([
      'id',
      'choice',
      'createdAt',
      'proposalId',
      'reason',
      'voterAddress',
      'votingPower',
    ])
    .where('proposalId', '=', proposalId)
    .orderBy('createdAt', 'desc') // Often useful to order votes
    .execute();

  // 2. Optimize: Fetch all unique voter addresses at once
  const voterAddresses = [...new Set(votes.map((vote) => vote.voterAddress))];

  if (voterAddresses.length === 0) {
    // If no voters, map votes and add default/null values
    return votes.map((vote) => ({
      ...vote,
      ens: null,
      avatar: `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: null,
      discourseUsername: null,
      voterAddress: vote.voterAddress, // Ensure voterAddress is present
    }));
  }

  // 3. Fetch all voters in a single query, including their ID
  const voters = await dbIndexer
    .selectFrom('voter')
    .select(['id', 'address', 'ens', 'avatar'])
    .where('address', 'in', voterAddresses)
    .execute();

  // Create maps for efficient voter lookup by address and ID
  const voterMap = new Map(voters.map((voter) => [voter.address, voter]));
  const voterIds = voters.map((v) => v.id);

  // 4. Fetch latest voting power for each voter (optimized)
  const latestVotingPowers = await dbIndexer
    .selectFrom('votingPower')
    .select(['voter', 'votingPower'])
    .where('voter', 'in', voterAddresses)
    .where('daoId', '=', daoId) // Ensure VP is for the correct DAO
    .orderBy('voter', 'asc')
    .orderBy('timestamp', 'desc')
    .distinctOn('voter') // Corrected: Use 'voter' here, not 'votingPower.voter'
    .execute();

  // Create a map for efficient latest voting power lookup
  const latestVotingPowerMap = new Map(
    latestVotingPowers.map((vp) => [vp.voter, vp.votingPower])
  );

  // --- New Steps for Discourse User ---

  // 5. Find the delegate link for each voter (most recent verified link)
  const delegateToVoterLinks = await dbIndexer
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
  const daoDiscourse = await dbIndexer
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
    const delegateToDiscourseLinks = await dbIndexer
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
      const discourseUsers = await dbIndexer
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
  const votesWithVoters = votes.map((vote) => {
    const voter = voterMap.get(vote.voterAddress);
    const latestVotingPower = latestVotingPowerMap.get(vote.voterAddress);

    // Find the discourse user
    let discourseUser: Selectable<DiscourseUser> | null = null;
    if (voter) {
      const delegateId = delegateIdByVoterId.get(voter.id);
      if (delegateId) {
        // *** Now this lookup should work ***
        const discourseUserId = discourseUserIdByDelegateId.get(delegateId);
        if (discourseUserId) {
          discourseUser = discourseUserMap.get(discourseUserId) || null;
        }
      }
    }

    // Construct the final object for this vote
    return {
      ...vote,
      ens: voter?.ens || null,
      avatar:
        voter?.avatar ||
        discourseUser?.avatarTemplate ||
        `https://api.dicebear.com/9.x/pixel-art/png?seed=${vote.voterAddress}`,
      latestVotingPower: latestVotingPower ?? null, // Use nullish coalescing for clarity
      discourseUsername: discourseUser?.username || null,
      discourseAvatarUrl: discourseUser?.avatarTemplate || null,
      voterAddress: vote.voterAddress, // Explicitly ensure voterAddress is included
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
  'use cache';
  cacheLife('hours');

  voterAddressSchema.parse(voterAddress);

  // Get the voter
  const voter = await dbIndexer
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
  'use cache';
  cacheLife('hours');

  voterAddressSchema.parse(voterAddress);
  daoSlugSchema.parse(daoSlug);
  proposalIdSchema.parse(proposalId);

  // Get the proposal to determine timestamps
  const proposal = await dbIndexer
    .selectFrom('proposal')
    .where('id', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!proposal) return null;

  // Get the dao
  const dao = await dbIndexer
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .selectAll()
    .executeTakeFirst();

  if (!dao) return null;

  // Get the vote
  const vote = await dbIndexer
    .selectFrom('vote')
    .where('voterAddress', '=', voterAddress)
    .where('proposalId', '=', proposalId)
    .selectAll()
    .executeTakeFirst();

  if (!vote) return null;

  // Get the latest voting power
  const latestVotingPowerRecord = await dbIndexer
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

// Centralized mock data for Storybook stories
import type { Selectable } from '@proposalsapp/db';
import { ProposalState } from '@proposalsapp/db';

// Mock author data
export const mockDiscourseUser = {
  id: 'user-123',
  username: 'vitalik.eth',
  name: 'Vitalik Buterin',
  avatarTemplate: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
  daoDiscourseId: 'dao-discourse-1',
  externalId: 1,
  daysVisited: 150,
  likesGiven: 85,
  likesReceived: 342,
  postCount: 67,
  postsRead: 1250,
  title: 'Core Developer',
  topicCount: 23,
  topicsEntered: 178,
};

export const mockDelegate = {
  id: 'delegate-123',
  voterAddress: '0x742d35Cc6634C0532925a3b8D56B5FB2E6e7a8aB',
  delegatetovoter: {
    ens: 'vitalik.eth',
    latestVotingPower: {
      votingPower: 1250000,
    },
  },
};

export const mockVoterAuthor = {
  id: 'vote-for-123',
  choice: 1,
  createdAt: new Date('2024-01-16T14:22:00Z'),
  proposalId: 'proposal-456',
  reason:
    'I strongly support this proposal because it aligns with our long-term vision for decentralized governance.',
  voterAddress: '0x742d35Cc6634C0532925a3b8D56B5FB2E6e7a8aB',
  votingPower: 1250000,
  ens: 'vitalik.eth',
  avatar: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
  latestVotingPower: 1250000,
  discourseUsername: 'vitalik.eth',
  discourseAvatarUrl: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
};

// Mock post data
export const mockPost = {
  id: 'post-456',
  topicId: 123,
  postNumber: 5,
  userId: 1,
  daoDiscourseId: 'dao-discourse-1',
  externalId: 456,
  cooked: `
    <h2>Proposal Summary</h2>
    <p>This proposal aims to improve the governance process by implementing new voting mechanisms that will make participation more accessible to all community members.</p>

    <h3>Key Benefits</h3>
    <ul>
      <li>Increased voter participation</li>
      <li>More transparent decision-making</li>
      <li>Better representation of community interests</li>
    </ul>

    <p>The implementation will be phased over 3 months with regular checkpoints to ensure we're meeting our goals. We believe this will significantly enhance our DAO's effectiveness.</p>

    <blockquote>
      <p>"Good governance is the single most important factor for eradicating poverty and promoting development." - Kofi Annan</p>
    </blockquote>

    <p>I look forward to your feedback and support on this important initiative.</p>
  `,
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
  deleted: false,
  reads: 387,
  version: 1,
  name: 'Governance Proposal Discussion',
  username: 'vitalik.eth',
  replyCount: 12,
  score: 85,
  topicSlug: 'governance-improvement-proposal',
  canViewEditHistory: true,
  displayUsername: null,
  flairBgColor: null,
  flairColor: null,
  flairName: null,
  flairUrl: null,
  incomingLinkCount: 3,
  postType: 1,
  primaryGroupName: null,
  quoteCount: 1,
  readersCount: 156,
  replyToPostNumber: null,
};

export const mockLongPost = {
  ...mockPost,
  id: 'post-long',
  cooked: `
    <h2>Comprehensive Analysis of Governance Token Distribution</h2>
    <p>This extensive proposal outlines a detailed framework for optimizing governance token distribution across our ecosystem. The current model has several limitations that we need to address through careful analysis and strategic implementation.</p>

    <h3>Current State Analysis</h3>
    <p>Our current governance structure shows concerning patterns in voter participation. Only 12% of token holders actively participate in governance decisions, which represents a significant challenge to the legitimacy of our decision-making process.</p>

    <h4>Participation Metrics</h4>
    <ul>
      <li>Active voters: 12% of total token holders</li>
      <li>Average proposal participation: 8.5%</li>
      <li>Delegate concentration: Top 10 delegates control 67% of voting power</li>
      <li>Geographic distribution: 78% North America/Europe, 22% rest of world</li>
    </ul>

    <h3>Proposed Solutions</h3>
    <p>To address these challenges, we propose a multi-faceted approach that includes both technological improvements and incentive restructuring.</p>

    <h4>Technical Improvements</h4>
    <ol>
      <li>Implement gasless voting mechanisms to reduce participation barriers</li>
      <li>Develop mobile-first voting interfaces</li>
      <li>Create delegated voting with granular control</li>
      <li>Build real-time governance dashboards</li>
    </ol>

    <h4>Incentive Restructuring</h4>
    <p>The current incentive structure doesn't adequately reward active participation. We propose:</p>
    <ul>
      <li>Voting rewards for consistent participation</li>
      <li>Reputation-based influence multipliers</li>
      <li>Participation NFTs for milestone achievements</li>
      <li>Community recognition programs</li>
    </ul>

    <h3>Implementation Timeline</h3>
    <p>This proposal requires careful phased implementation over 6 months:</p>

    <h4>Phase 1 (Months 1-2): Infrastructure</h4>
    <p>Focus on building the technical foundation for improved governance participation.</p>

    <h4>Phase 2 (Months 3-4): Testing and Refinement</h4>
    <p>Deploy features to a testnet environment and gather community feedback.</p>

    <h4>Phase 3 (Months 5-6): Full Deployment</h4>
    <p>Roll out the complete system with monitoring and adjustment capabilities.</p>

    <h3>Budget Requirements</h3>
    <p>The total budget for this initiative is estimated at $2.5M, broken down as follows:</p>
    <ul>
      <li>Development costs: $1.8M</li>
      <li>Security audits: $400K</li>
      <li>Community incentives: $200K</li>
      <li>Contingency: $100K</li>
    </ul>

    <h3>Risk Analysis</h3>
    <p>We've identified several potential risks and mitigation strategies:</p>

    <h4>Technical Risks</h4>
    <ul>
      <li>Smart contract vulnerabilities - Mitigated through extensive auditing</li>
      <li>Scalability concerns - Addressed through Layer 2 implementation</li>
      <li>User experience issues - Resolved through iterative design process</li>
    </ul>

    <h4>Governance Risks</h4>
    <ul>
      <li>Power concentration - Balanced through delegation limits</li>
      <li>Low participation - Addressed through incentive mechanisms</li>
      <li>Gaming attempts - Prevented through reputation systems</li>
    </ul>

    <h3>Success Metrics</h3>
    <p>We will measure success through the following key performance indicators:</p>
    <ul>
      <li>Increase voter participation to 25% within 6 months</li>
      <li>Reduce delegate concentration to under 50% for top 10</li>
      <li>Achieve global geographic distribution of 60/40 split</li>
      <li>Maintain security with zero critical vulnerabilities</li>
    </ul>

    <h3>Conclusion</h3>
    <p>This comprehensive approach to governance improvement represents a significant step forward for our DAO. By addressing both technical and incentive-based barriers to participation, we can create a more inclusive and effective governance system that truly represents our community's interests.</p>

    <p>I encourage all community members to review this proposal carefully and provide feedback. Together, we can build a governance system that serves as a model for the entire DeFi ecosystem.</p>
  `,
  reads: 1247,
};

export const mockDeletedPost = {
  ...mockPost,
  id: 'post-deleted',
  deleted: true,
  cooked: null,
};

// Mock vote data
export const mockVoteFor = {
  id: 'vote-for-123',
  proposalId: 'proposal-456',
  voterAddress: '0x742d35Cc6634C0532925a3b8D56B5FB2E6e7a8aB',
  choice: [{ choiceIndex: 0, text: 'For', weight: 100, color: '#69E000' }],
  votingPower: 1250000,
  relativeVotingPower: 0.85,
  reason:
    'I strongly support this proposal because it aligns with our long-term vision for decentralized governance. The proposed changes will make our DAO more accessible and transparent.',
  createdAt: new Date('2024-01-16T14:22:00Z'),
  aggregate: false,
};

export const mockVoteAgainst = {
  id: 'vote-against-123',
  proposalId: 'proposal-456',
  voterAddress: '0x8ba1f109551bD432803012645Hac136c5B8C67C8',
  choice: [{ choiceIndex: 1, text: 'Against', weight: 100, color: '#FF4C42' }],
  votingPower: 850000,
  relativeVotingPower: 0.58,
  reason:
    'While I appreciate the effort, I believe this proposal needs more development time before implementation.',
  createdAt: new Date('2024-01-16T16:45:00Z'),
  aggregate: false,
};

export const mockVoteAbstain = {
  id: 'vote-abstain-123',
  proposalId: 'proposal-456',
  voterAddress: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
  choice: [{ choiceIndex: 2, text: 'Abstain', weight: 100, color: '#FFCC33' }],
  votingPower: 425000,
  relativeVotingPower: 0.29,
  reason: 'I need more information before making a decision on this proposal.',
  createdAt: new Date('2024-01-16T18:10:00Z'),
  aggregate: false,
};

export const mockWeightedVote = {
  id: 'vote-weighted-123',
  proposalId: 'proposal-456',
  voterAddress: '0x742d35Cc6634C0532925a3b8D56B5FB2E6e7a8aB',
  choice: [
    { choiceIndex: 0, text: 'Option A', weight: 60, color: '#69E000' },
    { choiceIndex: 1, text: 'Option B', weight: 30, color: '#FF4C42' },
    { choiceIndex: 2, text: 'Option C', weight: 10, color: '#FFCC33' },
  ],
  votingPower: 2100000,
  relativeVotingPower: 0.92,
  reason:
    'I support a mixed approach with primary focus on Option A, secondary on Option B, and minimal allocation to Option C.',
  createdAt: new Date('2024-01-16T20:30:00Z'),
  aggregate: false,
};

export const mockApprovalVote = {
  id: 'vote-approval-123',
  proposalId: 'proposal-456',
  voterAddress: '0x742d35Cc6634C0532925a3b8D56B5FB2E6e7a8aB',
  choice: [
    { choiceIndex: 0, text: 'Alice', weight: 100, color: '#69E000' },
    { choiceIndex: 1, text: 'Bob', weight: 100, color: '#3B82F6' },
    { choiceIndex: 2, text: 'Charlie', weight: 100, color: '#8B5CF6' },
  ],
  votingPower: 1750000,
  relativeVotingPower: 0.76,
  reason:
    'I support Alice, Bob, and Charlie as they all bring valuable skills to the council.',
  createdAt: new Date('2024-01-16T22:15:00Z'),
  aggregate: false,
};

export const mockAggregateVote = {
  id: 'vote-aggregate-123',
  proposalId: 'proposal-456',
  voterAddress: 'Multiple voters',
  choice: [{ choiceIndex: 0, text: 'For', weight: 100, color: '#69E000' }],
  votingPower: 3250000,
  relativeVotingPower: 0.95,
  reason: null,
  createdAt: new Date('2024-01-16T23:45:00Z'),
  aggregate: true,
};

// Mock group data
export const mockGroup = {
  dao: {
    id: 'dao-arbitrum',
    name: 'Arbitrum DAO',
    picture: 'https://api.dicebear.com/9.x/pixel-art/png?seed=arbitrum',
    slug: 'arbitrum',
  },
  daoDiscourse: {
    daoId: 'dao-arbitrum',
    id: 'dao-discourse-1',
    enabled: true,
    discourseBaseUrl: 'https://forum.arbitrum.foundation',
    withUserAgent: true,
  },
  group: {
    id: 'group-789',
    name: 'Governance Improvement Proposal',
    items: [
      {
        type: 'topic' as const,
        name: 'Discussion Thread',
        externalId: '123',
        daoDiscourseId: 'dao-discourse-1',
      },
      {
        type: 'proposal' as const,
        name: 'AIP-1: Governance Improvement',
        externalId: 'proposal-456',
        governorId: 'governor-arbitrum',
      },
    ],
    daoId: 'dao-arbitrum',
    createdAt: new Date('2024-01-15T10:30:00Z'),
  },
  proposals: [
    {
      id: 'proposal-456',
      externalId: 'proposal-456',
      governorId: 'governor-arbitrum',
      name: 'AIP-1: Governance Improvement Proposal',
      body: 'This proposal aims to improve the governance process by implementing new voting mechanisms that will make participation more accessible to all community members.',
      author: '0x742d35Cc6634C0532925a3b8D56B5FB2E6e7a8aB',
      url: 'https://snapshot.org/#/arbitrumfoundation.eth/proposal/0x123...',
      daoId: 'dao-arbitrum',
      createdAt: new Date('2024-01-15T10:30:00Z'),
      startAt: new Date('2024-01-15T12:00:00Z'),
      endAt: new Date('2024-01-22T12:00:00Z'),
      blockCreatedAt: 180500000,
      blockStartAt: 180500100,
      blockEndAt: 180550000,
      proposalState: ProposalState.ACTIVE,
      quorum: 1000000,
      choices: ['For', 'Against', 'Abstain'],
      metadata: {
        voteType: 'basic',
        quorumChoices: [0, 2],
      },
      discussionUrl:
        'https://forum.arbitrum.foundation/t/governance-improvement-proposal/123',
      txid: '0x123abc...',
      markedSpam: false,
      governorName: 'Arbitrum Core Governor',
      governorType: 'ARBITRUM_CORE' as const,
    },
  ],
  topics: [
    {
      id: 'topic-123',
      externalId: 123,
      title: 'Governance Improvement Proposal Discussion',
      fancyTitle: 'Governance Improvement Proposal Discussion',
      slug: 'governance-improvement-proposal',
      daoDiscourseId: 'dao-discourse-1',
      categoryId: 5,
      createdAt: new Date('2024-01-15T10:30:00Z'),
      lastPostedAt: new Date('2024-01-16T23:45:00Z'),
      bumpedAt: new Date('2024-01-16T23:45:00Z'),
      archived: false,
      closed: false,
      pinned: false,
      pinnedGlobally: false,
      visible: true,
      postsCount: 23,
      replyCount: 22,
      likeCount: 42,
      views: 387,
    },
  ],
  daoSlug: 'arbitrum',
  groupId: 'group-789',
};

export const mockGroupWithWeightedVoting = {
  ...mockGroup,
  proposals: [
    {
      ...mockGroup.proposals[0],
      metadata: {
        voteType: 'weighted',
        quorumChoices: [0, 1, 2],
      },
    },
  ],
};

// Mock server action responses
export const mockServerActions = {
  getDiscourseUser: async () => mockDiscourseUser,
  getDelegateByDiscourseUser: async () => mockDelegate,
  getPostLikesCount: async () => 42,
};

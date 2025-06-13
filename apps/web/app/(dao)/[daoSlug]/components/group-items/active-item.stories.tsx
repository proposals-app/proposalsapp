import type { Meta, StoryObj } from '@storybook/nextjs';
import { ActiveGroupItem } from './active-item';
import { TimelineEventType } from '@/lib/types';
import { ProposalState } from '@proposalsapp/db';

const meta: Meta<typeof ActiveGroupItem> = {
  title: 'DAO/Group Items/ActiveGroupItem',
  component: ActiveGroupItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
  },
  args: {
    currentTime: new Date('2025-06-13T19:47:50.621Z'),
  },
  argTypes: {
    currentTime: {
      control: 'date',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActiveGroupItem>;

export const Default: Story = {
  args: {
    group: {
      id: 'a639133f-3324-4d16-9a3f-1c60af79065b',
      name: '[Non-Constitutional] Let’s improve our governance forum with three proposals.app feature integrations',
      slug: 'a639133f-3324-4d16-9a3f-1c60af79065b',
      authorName: 'paulofonseca',
      authorAvatarUrl:
        'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/paulofonseca/96/13858_2.png',
      latestActivityAt: new Date('2025-06-13T15:15:30.398Z'),
      hasNewActivity: false,
      hasActiveProposal: true,
      topicsCount: 1,
      proposalsCount: 1,
      votesCount: 1233,
      postsCount: 45,
    },
    feedData: {
      votes: [],
      posts: [],
      events: [
        {
          content: 'Offchain vote ends in 6 days',
          type: TimelineEventType.ResultOngoingBasicVote,
          timestamp: new Date('2025-06-19T17:51:39.000Z'),
          result: {
            proposal: {
              id: '5bf61c68-c25f-4734-8b06-6ac6570c1c7b',
              externalId:
                '0x38663c36b26252acff6c6ca43663167858f51f960235dc0441bd2ad4a8f66fb1',
              name: 'Let’s improve our governance forum with three proposals.app feature integrations',
              body: "# Let’s improve our governance forum with three proposals.app feature integrations\n\n## Abstract\n\n[proposals.app](https://proposals.app) proposes a formal collaboration with Arbitrum DAO to enhance the usability of this governance forum, so that delegates, tokenholders, and forum readers can have more context and information about our DAO proposals. We propose designing, developing, testing, and deploying three feature integrations in this governance forum, as well as maintaining and hosting them for a period of one year, for a total of **$60,000 USD**.\n\n## Motivation\n\n**Currently, DAO governance remains a disjointed, messy, and confusing experience for delegates and tokenholders.** We believe that one of the main reasons for this is the clear lack of foundational DAO tooling that prioritizes true composability and aggregates data from multiple (even competing) offchain and onchain sources, thereby providing a more comprehensive and enjoyable user experience for DAO delegates and tokenholders. We believe that to achieve this, DAO tools should be free and open-source, operate under a non-profit entity that ideally has public financial records of its operations. At proposals.app, we strive to uphold these beliefs.\n\n[Andrei](https://andreiv.com) and I have been building DAO tools since mid-2023, starting with [Senate](https://x.com/SenateLabs), where we previously piloted two forum integrations (one with [Uniswap](https://gov.uniswap.org/t/rfc-should-uniswap-enable-a-dedicated-governance-tool-for-delegates-and-voters/21044), and another with [Aave](https://governance.aave.com/t/temp-check-proposal-for-senate-to-enable-dedicated-tooling-for-aave-governance/12680)), and more recently, we’ve been working on [proposals.app](https://x.com/proposalsapp), where we’ve developed dedicated tooling for Arbitrum DAO’s governance needs that was funded through [a questbook grant](https://questbook.app/dashboard/?grantId=662f31c25488d5000f055a54&chainId=10&proposalId=66eda59a8868f5130a656e1f&isRenderingProposalBody=true) last October. More specifically, we’ve designed and developed a [unified governance aggregator](https://forum.arbitrum.foundation/t/arbitrum-proposals-app-govhack-brussels-winner/25370) that brings together, under the same platform, the discourse forum comments and both offchain and onchain votes, so that delegates can access the complete history of every proposal in Arbitrum DAO. We launched it publicly on April 5ᵗʰ at ETH Bucharest 2025, and you can check it out at [arbitrum.proposals.app](https://arbitrum.proposals.app) and share your thoughts about it with us in [our telegram chat](https://t.me/+U9QrY4L8wfNiMzA8).\n\nWe’re now proposing **a formal collaboration with Arbitrum DAO** to bring some of the exclusive proposals.app features we have in our app, to this governance forum. **We propose designing, developing, testing, and deploying three feature integrations in this governance forum**, as well as maintaining and hosting them for a period of 12 months.\n\n![Demo of the three proposals.app feature integrations](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/original/2X/7/7e148a110ffeb8388f8bccdee73242f41437c45d.gif)\n\nWe believe that **these three features will enhance usability and accessibility** in this governance forum for all users, regardless of their level of maturity.\n\nThese three features, as demonstrated above, are:\n\n1. **Live Votes** – Show the live or latest vote at the top of the page for each forum topic in the proposals category\n2. **Voting Power Tags** – Show the voting power of each delegate, under their username, for every comment on the forum\n3. **Proposal Notification Emails** – Provide a way for forum visitors to subscribe to email notifications, receiving an email every time a new discussion is started, when an offchain or onchain vote begins, and when its voting period is nearing completion.\n\nWith these three proposals.app feature integrations in this forum, we believe will see **bigger governance participation and better engagement in discussions**, from a more diverse set of delegates and tokenholders, who will have more context about who is commenting on what, about when proposals are up to a vote and where and when to vote in each moment of the proposal lifecycle.\n\nWe shared a short demo of proposals.app and these three proposed feature integrations on the [Open Governance Call on June 3rd](https://forum.arbitrum.foundation/t/june-3-2025-open-discussion-of-proposals-governance-call/29377?u=paulofonseca), and you can see the recording of that demo and presentation, as well as some Q&A, in this [video](https://www.youtube.com/embed/5MToHsWqQxs).\n\n## Rationale\n\nConstantly improving and caring for the governance processes in Arbitrum DAO is essential to maintain a healthy, engaged, resilient, and decentralized DAO. In Arbitrum DAO’s case, where tokenholders and delegates actually have on-chain control over protocol upgrades and treasury spending, it becomes even more critical that **they vote with as much context and information as possible in each and every vote.**\n\nAdditionally, **in token-weighted voting DAOs, not all voices carry the same weight.** Powerful delegates commenting and giving feedback on proposals are crucial signals of support. On the other hand, newly created forum accounts with no voting power, which are becoming more prevalent in the age of AI, make way more noise than signal and disrupt the discussion flow. Proposers and readers should be able to distinguish between the two and everything in between, much more easily.\n\nAs stated in [The Amended Constitution of the Arbitrum DAO](https://docs.arbitrum.foundation/dao-constitution), we should strive to follow our stated Community Values, and specifically:\n\n> **Neutral and open:** Arbitrum governance should not pick winners and losers, but should foster open innovation, interoperation, user choice, and healthy competition on Arbitrum chains.\n\nWe believe it’s essential for Arbitrum DAO to have multiple governance platforms available to its tokenholders, delegates, and voters, so that we can attract more and better delegates and voters by providing them with tools that suit their particular needs and help them engage in governance in an easier and clearer way.\n\nWe also strongly believe that at least one of those front-ends should be fully open-source. Regarding the obvious matter of the resilience of Arbitrum’s DAO governance, we believe there should be a fully open-source front-end for Arbitrum’s DAO governance that would allow delegates and voters to continue participating in governance permissionlessly. [proposals.app](https://proposals.app/) [is fully open source](https://github.com/proposals-app/proposalsapp) and will continue to be. [proposals.app](https://proposals.app/) and its future developments can also be self-hosted by anyone (like we’re doing now) under a new domain name, at any time, by anybody in the world.\n\n## Specifications\n\nTo implement these three forum feature integrations described above, we will create **three distinct Discourse theme components**, rather than Discourse plugins.\n\nThis way, admins of Discourse hosted instances (like the one for the Arbitrum DAO forum) can easily install each one of these feature integrations from a GitHub repo link (where the code will be fully open-source and auditable, of course) and manage the updates for each feature integration independently, as we evolve and maintain them after the initial deployment.\n\nAs mentioned above, this is how we previously integrated with the [Uniswap](https://gov.uniswap.org/t/rfc-should-uniswap-enable-a-dedicated-governance-tool-for-delegates-and-voters/21044) and [Aave](https://governance.aave.com/t/temp-check-proposal-for-senate-to-enable-dedicated-tooling-for-aave-governance/12680) governance forums, in the past.\n\n## Steps to Implement\n\nWe will design, develop, test, and deploy these 3 Discourse forum proposals.app feature integrations, **in the following order**:\n\n1. **Voting Power Tags** – Showing discourse users’ voting power alongside their usernames in every topic and post in the Arbitrum DAO governance forum. To achieve this, we must **retrieve all previous delegation data for the $ARB token** and **maintain a mapping between the top discourse users and voting wallets** on Arbitrum DAO. This voting power tag will always display the current voting power of each delegate by default. Upon clicking on it, the delegate's voting power at the time the comment was posted will be displayed instead.\n![Voting Power Tag showing Entropy's 25.7M ARB delegated voting power, at the time of posting this comment.](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/original/2X/0/02def7ab1879f9cda62eb6e95cc3a5b5efbfb34b.png)\n\n2. **Live Votes** – In every proposal posted in the Arbitrum DAO governance forum, which goes up for an offchain or onchain vote, we will display a component at the top of the forum proposal page, which shows that there is an active offchain or onchain vote, the current live results of that offchain or onchain vote, and a link to vote on it. To achieve this, we must **map all forum proposals and their respective Snapshot votes and onchain votes**, as well as index all voting data from either Snapshot’s API or the onchain Arbitrum DAO Governors (both the non-constitutional Arbitrum Treasury governor and the constitutional Arbitrum Core governor).\n![Live Vote results on the Quorum Threshold Reduction proposal in the forum, showing that there is an active offchain vote which ends in 4 hours, and directing delegates to the voting platform.](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/optimized/2X/7/71103527189f961b216823e9244ce2bada38daa1_2_1380x608.png)\n\n3. **Proposal Notification Emails** – In the Arbitrum DAO governance forum homepage, we will display a “Setup Proposal Notifications” button, which will open a modal for forum users to subscribe to email notifications, so that they can receive timely emails whenever a new proposal discussion is posted on the forum, when an offchain or onchain vote starts, and when an offchain or onchain vote is about to end. To achieve this, **we need to maintain a GDPR-compliant list of emails and newsletters**, as well as **a dedicated subdomain and address** to send email notifications from, ensuring optimal email deliverability for those email notifications.\n![Modal to subscribe to proposal email notifications](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/optimized/2X/2/2bf33def77a835475b48e616c3167df940d980c6_2_1380x542.jpeg)\n\n## Timeline\n\nFollowing the successful approval of this proposal and the initial onchain transfer, we will hold a project kickoff call and begin building the first integration, the **Voting Power Tags**, which we can deploy and deliver within one month. Then we will work on the **Live Votes** integration, which we can also deploy and deliver within one month. Finally, we will work on the **Proposal Notification Emails** integration, which we will also deploy and deliver within one month.\n\nIn total, it will take us **1 month to deliver these three feature integrations** to the Arbitrum DAO after the project kickoff call, which should happen after a successful onchain vote. During this time, we will work with all Arbitrum DAO delegates to gather feedback on this functionality and improve it to meet your needs. After deploying all these integrations, we will **maintain and host them for a period of 12 months**.\n\n![Timeline](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/optimized/2X/1/18798e403cebe644a8d714f49321de47ce8af6a4_2_1380x400.png)\n\nWe plan to put this proposal up for a temperature check **offchain vote on Thursday, June 12th**. After a successful offchain vote, we will move this proposal and publish an **onchain vote on Monday, June 23rd**, to start the voting period on Thursday, June 26th.\n\n===\n\nAfter a successful onchain vote, we can kick off this work and start the timeline proposed above, **as early as July 15th.**\n\n===\n\nThis would mean that we could deliver all of the proposed scope, 1 month later, **on August 15th**.\n\n## Overall Cost\n\nWe propose to build, maintain, and host these three feature integrations for Arbitrum for a minimum of 12 months. The total cost to the Arbitrum DAO, is **$60,000 USD**.\n\nHere is the cost breakdown:\n\n| Item | Amount |\n| ------------------- | ------: |\n| **Maintenance** 1 year (1 day of Design + 1 day of Development + 1 day of Testing, per month) | $48,000 USD |\n| **Hosting** 1 year (3 Servers, DNS, and Emails) | $12,000 USD |\n| **Total** | **$60,000 USD** |\n\nThe **Maintenance** fee includes 1 day per month of Design, 1 day per month of Development, and 1 day per month of Testing, to ensure we maintain these features with an up-to-date user experience and quality of service, and that we can incorporate the delegates’ future feedback on these proposals.app feature integrations.\n\nThe **Hosting** fee includes the monthly costs for all the infrastructure we use, which can be live-monitored on [status.proposals.app](https://status.proposals.app/).\n\nWe propose that the payment be done as a one-time payment of $60,000 USD.\n\nAfter a successful onchain vote, the funds should be transferred either to **the MSS or the Arbitrum Foundation** (depending on the outcome of the current [Wind Down the MSS](https://forum.arbitrum.foundation/t/wind-down-the-mss-transfer-payment-responsibilities-to-the-arbitrum-foundation/29279) proposal), which would certify the delivery of the three feature integrations and release the payment after a successful deployment.\n\n## Pledge\n\nAndrei and Paulo pledge to continually work towards a future where DAO governance tools are genuinely credibly neutral. Therefore, our work is [public](https://www.youtube.com/watch?v=4ErD4sHs2Zk&list=PLaYDaaHm0oQGefGFDg8dt77ce7MQaUghG), fully [open-source](https://github.com/proposals-app), and happens with transparent [financials](https://app.safe.global/transactions/history?safe=arb1:0x6eFfD7b13e4D3c53b9C528d96Af0Fe8CfE32ba2E). Additionally, proposals.app will soon be established as a non-profit entity, and we pledge never to accept venture capital funding. Until now, proposals.app has only received [a $43,000 USD grant](https://questbook.app/dashboard/?grantId=662f31c25488d5000f055a54&chainId=10&proposalId=66eda59a8868f5130a656e1f&isRenderingProposalBody=true) from Arbitrum DAO via Season 2 of the Domain Allocator grants on Questbook, as well as $6,000 USD for the first-place prize in the Arbitrum GovHack at ETHcc Brussels. No other funding, from any other source, was received, as shown in our [multisig](https://app.safe.global/home?safe=arb1:0x6eFfD7b13e4D3c53b9C528d96Af0Fe8CfE32ba2E).\n\n## 🙏 Thank you\n\nThank you for taking the time to read this proposal through to the end.",
              url: 'https://snapshot.box/#/s:arbitrumfoundation.eth/proposal/0x38663c36b26252acff6c6ca43663167858f51f960235dc0441bd2ad4a8f66fb1',
              discussionUrl:
                'https://forum.arbitrum.foundation/t/non-constitutional-let-s-improve-our-governance-forum-with-three-proposals-app-feature-integrations/29398',
              choices: ['For', 'Against', 'Abstain'],
              quorum: 0,
              proposalState: ProposalState.ACTIVE,
              markedSpam: false,
              createdAt: new Date('2025-06-12T17:51:39.000Z'),
              startAt: new Date('2025-06-12T17:51:39.000Z'),
              endAt: new Date('2025-06-19T17:51:39.000Z'),
              blockCreatedAt: null,
              txid: 'bafkreigizcln5zd5qqcp6lkohjyoljhouobrs3uz3k6ueyrevvwvyqgorq',
              metadata: {
                voteType: 'basic',
                scoresState: 'pending',
                quorumChoices: [0, 2],
              },
              daoId: 'f4b728d7-8117-4756-85d6-ca1a95412eaa',
              author: '0xA7860E99e3ce0752D1ac53b974E309fFf80277C6',
              governorId: '23b3d1c5-6c43-4216-b0e7-07ea1799a271',
              blockStartAt: null,
              blockEndAt: null,
            },
            choices: ['For', 'Against', 'Abstain'],
            choiceColors: ['#69E000', '#FF4C42', '#FFCC33'],
            totalVotingPower: 5801154.895043441,
            quorum: null,
            quorumChoices: [0, 2],
            voteType: 'basic',
            finalResults: {
              '0': 5545221.537432963,
              '1': 157824.3784380801,
              '2': 98108.97917239755,
            },
            hiddenVote: false,
            scoresState: 'pending',
            voteSegments: {
              '0': [
                {
                  votingPower: 4185254.5965638887,
                },
                {
                  votingPower: 605635.418715801,
                },
                {
                  votingPower: 198104.30642255247,
                },
                {
                  votingPower: 168751.62837331952,
                },
                {
                  votingPower: 150034.6845021319,
                },
                {
                  votingPower: 237440.9028552708,
                  isAggregated: true,
                },
              ],
              '1': [
                {
                  votingPower: 95080.43921070972,
                },
                {
                  votingPower: 61880.41235622238,
                },
                {
                  votingPower: 863.526871148018,
                  isAggregated: true,
                },
              ],
              '2': [
                {
                  votingPower: 96860.059382736,
                },
                {
                  votingPower: 1248.9197896615638,
                  isAggregated: true,
                },
              ],
            },
          },
          proposal: {
            id: '5bf61c68-c25f-4734-8b06-6ac6570c1c7b',
            externalId:
              '0x38663c36b26252acff6c6ca43663167858f51f960235dc0441bd2ad4a8f66fb1',
            name: 'Let’s improve our governance forum with three proposals.app feature integrations',
            body: "# Let’s improve our governance forum with three proposals.app feature integrations\n\n## Abstract\n\n[proposals.app](https://proposals.app) proposes a formal collaboration with Arbitrum DAO to enhance the usability of this governance forum, so that delegates, tokenholders, and forum readers can have more context and information about our DAO proposals. We propose designing, developing, testing, and deploying three feature integrations in this governance forum, as well as maintaining and hosting them for a period of one year, for a total of **$60,000 USD**.\n\n## Motivation\n\n**Currently, DAO governance remains a disjointed, messy, and confusing experience for delegates and tokenholders.** We believe that one of the main reasons for this is the clear lack of foundational DAO tooling that prioritizes true composability and aggregates data from multiple (even competing) offchain and onchain sources, thereby providing a more comprehensive and enjoyable user experience for DAO delegates and tokenholders. We believe that to achieve this, DAO tools should be free and open-source, operate under a non-profit entity that ideally has public financial records of its operations. At proposals.app, we strive to uphold these beliefs.\n\n[Andrei](https://andreiv.com) and I have been building DAO tools since mid-2023, starting with [Senate](https://x.com/SenateLabs), where we previously piloted two forum integrations (one with [Uniswap](https://gov.uniswap.org/t/rfc-should-uniswap-enable-a-dedicated-governance-tool-for-delegates-and-voters/21044), and another with [Aave](https://governance.aave.com/t/temp-check-proposal-for-senate-to-enable-dedicated-tooling-for-aave-governance/12680)), and more recently, we’ve been working on [proposals.app](https://x.com/proposalsapp), where we’ve developed dedicated tooling for Arbitrum DAO’s governance needs that was funded through [a questbook grant](https://questbook.app/dashboard/?grantId=662f31c25488d5000f055a54&chainId=10&proposalId=66eda59a8868f5130a656e1f&isRenderingProposalBody=true) last October. More specifically, we’ve designed and developed a [unified governance aggregator](https://forum.arbitrum.foundation/t/arbitrum-proposals-app-govhack-brussels-winner/25370) that brings together, under the same platform, the discourse forum comments and both offchain and onchain votes, so that delegates can access the complete history of every proposal in Arbitrum DAO. We launched it publicly on April 5ᵗʰ at ETH Bucharest 2025, and you can check it out at [arbitrum.proposals.app](https://arbitrum.proposals.app) and share your thoughts about it with us in [our telegram chat](https://t.me/+U9QrY4L8wfNiMzA8).\n\nWe’re now proposing **a formal collaboration with Arbitrum DAO** to bring some of the exclusive proposals.app features we have in our app, to this governance forum. **We propose designing, developing, testing, and deploying three feature integrations in this governance forum**, as well as maintaining and hosting them for a period of 12 months.\n\n![Demo of the three proposals.app feature integrations](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/original/2X/7/7e148a110ffeb8388f8bccdee73242f41437c45d.gif)\n\nWe believe that **these three features will enhance usability and accessibility** in this governance forum for all users, regardless of their level of maturity.\n\nThese three features, as demonstrated above, are:\n\n1. **Live Votes** – Show the live or latest vote at the top of the page for each forum topic in the proposals category\n2. **Voting Power Tags** – Show the voting power of each delegate, under their username, for every comment on the forum\n3. **Proposal Notification Emails** – Provide a way for forum visitors to subscribe to email notifications, receiving an email every time a new discussion is started, when an offchain or onchain vote begins, and when its voting period is nearing completion.\n\nWith these three proposals.app feature integrations in this forum, we believe will see **bigger governance participation and better engagement in discussions**, from a more diverse set of delegates and tokenholders, who will have more context about who is commenting on what, about when proposals are up to a vote and where and when to vote in each moment of the proposal lifecycle.\n\nWe shared a short demo of proposals.app and these three proposed feature integrations on the [Open Governance Call on June 3rd](https://forum.arbitrum.foundation/t/june-3-2025-open-discussion-of-proposals-governance-call/29377?u=paulofonseca), and you can see the recording of that demo and presentation, as well as some Q&A, in this [video](https://www.youtube.com/embed/5MToHsWqQxs).\n\n## Rationale\n\nConstantly improving and caring for the governance processes in Arbitrum DAO is essential to maintain a healthy, engaged, resilient, and decentralized DAO. In Arbitrum DAO’s case, where tokenholders and delegates actually have on-chain control over protocol upgrades and treasury spending, it becomes even more critical that **they vote with as much context and information as possible in each and every vote.**\n\nAdditionally, **in token-weighted voting DAOs, not all voices carry the same weight.** Powerful delegates commenting and giving feedback on proposals are crucial signals of support. On the other hand, newly created forum accounts with no voting power, which are becoming more prevalent in the age of AI, make way more noise than signal and disrupt the discussion flow. Proposers and readers should be able to distinguish between the two and everything in between, much more easily.\n\nAs stated in [The Amended Constitution of the Arbitrum DAO](https://docs.arbitrum.foundation/dao-constitution), we should strive to follow our stated Community Values, and specifically:\n\n> **Neutral and open:** Arbitrum governance should not pick winners and losers, but should foster open innovation, interoperation, user choice, and healthy competition on Arbitrum chains.\n\nWe believe it’s essential for Arbitrum DAO to have multiple governance platforms available to its tokenholders, delegates, and voters, so that we can attract more and better delegates and voters by providing them with tools that suit their particular needs and help them engage in governance in an easier and clearer way.\n\nWe also strongly believe that at least one of those front-ends should be fully open-source. Regarding the obvious matter of the resilience of Arbitrum’s DAO governance, we believe there should be a fully open-source front-end for Arbitrum’s DAO governance that would allow delegates and voters to continue participating in governance permissionlessly. [proposals.app](https://proposals.app/) [is fully open source](https://github.com/proposals-app/proposalsapp) and will continue to be. [proposals.app](https://proposals.app/) and its future developments can also be self-hosted by anyone (like we’re doing now) under a new domain name, at any time, by anybody in the world.\n\n## Specifications\n\nTo implement these three forum feature integrations described above, we will create **three distinct Discourse theme components**, rather than Discourse plugins.\n\nThis way, admins of Discourse hosted instances (like the one for the Arbitrum DAO forum) can easily install each one of these feature integrations from a GitHub repo link (where the code will be fully open-source and auditable, of course) and manage the updates for each feature integration independently, as we evolve and maintain them after the initial deployment.\n\nAs mentioned above, this is how we previously integrated with the [Uniswap](https://gov.uniswap.org/t/rfc-should-uniswap-enable-a-dedicated-governance-tool-for-delegates-and-voters/21044) and [Aave](https://governance.aave.com/t/temp-check-proposal-for-senate-to-enable-dedicated-tooling-for-aave-governance/12680) governance forums, in the past.\n\n## Steps to Implement\n\nWe will design, develop, test, and deploy these 3 Discourse forum proposals.app feature integrations, **in the following order**:\n\n1. **Voting Power Tags** – Showing discourse users’ voting power alongside their usernames in every topic and post in the Arbitrum DAO governance forum. To achieve this, we must **retrieve all previous delegation data for the $ARB token** and **maintain a mapping between the top discourse users and voting wallets** on Arbitrum DAO. This voting power tag will always display the current voting power of each delegate by default. Upon clicking on it, the delegate's voting power at the time the comment was posted will be displayed instead.\n![Voting Power Tag showing Entropy's 25.7M ARB delegated voting power, at the time of posting this comment.](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/original/2X/0/02def7ab1879f9cda62eb6e95cc3a5b5efbfb34b.png)\n\n2. **Live Votes** – In every proposal posted in the Arbitrum DAO governance forum, which goes up for an offchain or onchain vote, we will display a component at the top of the forum proposal page, which shows that there is an active offchain or onchain vote, the current live results of that offchain or onchain vote, and a link to vote on it. To achieve this, we must **map all forum proposals and their respective Snapshot votes and onchain votes**, as well as index all voting data from either Snapshot’s API or the onchain Arbitrum DAO Governors (both the non-constitutional Arbitrum Treasury governor and the constitutional Arbitrum Core governor).\n![Live Vote results on the Quorum Threshold Reduction proposal in the forum, showing that there is an active offchain vote which ends in 4 hours, and directing delegates to the voting platform.](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/optimized/2X/7/71103527189f961b216823e9244ce2bada38daa1_2_1380x608.png)\n\n3. **Proposal Notification Emails** – In the Arbitrum DAO governance forum homepage, we will display a “Setup Proposal Notifications” button, which will open a modal for forum users to subscribe to email notifications, so that they can receive timely emails whenever a new proposal discussion is posted on the forum, when an offchain or onchain vote starts, and when an offchain or onchain vote is about to end. To achieve this, **we need to maintain a GDPR-compliant list of emails and newsletters**, as well as **a dedicated subdomain and address** to send email notifications from, ensuring optimal email deliverability for those email notifications.\n![Modal to subscribe to proposal email notifications](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/optimized/2X/2/2bf33def77a835475b48e616c3167df940d980c6_2_1380x542.jpeg)\n\n## Timeline\n\nFollowing the successful approval of this proposal and the initial onchain transfer, we will hold a project kickoff call and begin building the first integration, the **Voting Power Tags**, which we can deploy and deliver within one month. Then we will work on the **Live Votes** integration, which we can also deploy and deliver within one month. Finally, we will work on the **Proposal Notification Emails** integration, which we will also deploy and deliver within one month.\n\nIn total, it will take us **1 month to deliver these three feature integrations** to the Arbitrum DAO after the project kickoff call, which should happen after a successful onchain vote. During this time, we will work with all Arbitrum DAO delegates to gather feedback on this functionality and improve it to meet your needs. After deploying all these integrations, we will **maintain and host them for a period of 12 months**.\n\n![Timeline](https://canada1.discourse-cdn.com/flex029/uploads/arbitrum1/optimized/2X/1/18798e403cebe644a8d714f49321de47ce8af6a4_2_1380x400.png)\n\nWe plan to put this proposal up for a temperature check **offchain vote on Thursday, June 12th**. After a successful offchain vote, we will move this proposal and publish an **onchain vote on Monday, June 23rd**, to start the voting period on Thursday, June 26th.\n\n===\n\nAfter a successful onchain vote, we can kick off this work and start the timeline proposed above, **as early as July 15th.**\n\n===\n\nThis would mean that we could deliver all of the proposed scope, 1 month later, **on August 15th**.\n\n## Overall Cost\n\nWe propose to build, maintain, and host these three feature integrations for Arbitrum for a minimum of 12 months. The total cost to the Arbitrum DAO, is **$60,000 USD**.\n\nHere is the cost breakdown:\n\n| Item | Amount |\n| ------------------- | ------: |\n| **Maintenance** 1 year (1 day of Design + 1 day of Development + 1 day of Testing, per month) | $48,000 USD |\n| **Hosting** 1 year (3 Servers, DNS, and Emails) | $12,000 USD |\n| **Total** | **$60,000 USD** |\n\nThe **Maintenance** fee includes 1 day per month of Design, 1 day per month of Development, and 1 day per month of Testing, to ensure we maintain these features with an up-to-date user experience and quality of service, and that we can incorporate the delegates’ future feedback on these proposals.app feature integrations.\n\nThe **Hosting** fee includes the monthly costs for all the infrastructure we use, which can be live-monitored on [status.proposals.app](https://status.proposals.app/).\n\nWe propose that the payment be done as a one-time payment of $60,000 USD.\n\nAfter a successful onchain vote, the funds should be transferred either to **the MSS or the Arbitrum Foundation** (depending on the outcome of the current [Wind Down the MSS](https://forum.arbitrum.foundation/t/wind-down-the-mss-transfer-payment-responsibilities-to-the-arbitrum-foundation/29279) proposal), which would certify the delivery of the three feature integrations and release the payment after a successful deployment.\n\n## Pledge\n\nAndrei and Paulo pledge to continually work towards a future where DAO governance tools are genuinely credibly neutral. Therefore, our work is [public](https://www.youtube.com/watch?v=4ErD4sHs2Zk&list=PLaYDaaHm0oQGefGFDg8dt77ce7MQaUghG), fully [open-source](https://github.com/proposals-app), and happens with transparent [financials](https://app.safe.global/transactions/history?safe=arb1:0x6eFfD7b13e4D3c53b9C528d96Af0Fe8CfE32ba2E). Additionally, proposals.app will soon be established as a non-profit entity, and we pledge never to accept venture capital funding. Until now, proposals.app has only received [a $43,000 USD grant](https://questbook.app/dashboard/?grantId=662f31c25488d5000f055a54&chainId=10&proposalId=66eda59a8868f5130a656e1f&isRenderingProposalBody=true) from Arbitrum DAO via Season 2 of the Domain Allocator grants on Questbook, as well as $6,000 USD for the first-place prize in the Arbitrum GovHack at ETHcc Brussels. No other funding, from any other source, was received, as shown in our [multisig](https://app.safe.global/home?safe=arb1:0x6eFfD7b13e4D3c53b9C528d96Af0Fe8CfE32ba2E).\n\n## 🙏 Thank you\n\nThank you for taking the time to read this proposal through to the end.",
            url: 'https://snapshot.box/#/s:arbitrumfoundation.eth/proposal/0x38663c36b26252acff6c6ca43663167858f51f960235dc0441bd2ad4a8f66fb1',
            discussionUrl:
              'https://forum.arbitrum.foundation/t/non-constitutional-let-s-improve-our-governance-forum-with-three-proposals-app-feature-integrations/29398',
            choices: ['For', 'Against', 'Abstain'],
            quorum: 0,
            proposalState: ProposalState.ACTIVE,
            markedSpam: false,
            createdAt: new Date('2025-06-12T17:51:39.000Z'),
            startAt: new Date('2025-06-12T17:51:39.000Z'),
            endAt: new Date('2025-06-19T17:51:39.000Z'),
            blockCreatedAt: null,
            txid: 'bafkreigizcln5zd5qqcp6lkohjyoljhouobrs3uz3k6ueyrevvwvyqgorq',
            metadata: {
              voteType: 'basic',
              scoresState: 'pending',
              quorumChoices: [0, 2],
            },
            daoId: 'f4b728d7-8117-4756-85d6-ca1a95412eaa',
            author: '0xA7860E99e3ce0752D1ac53b974E309fFf80277C6',
            governorId: '23b3d1c5-6c43-4216-b0e7-07ea1799a271',
            blockStartAt: null,
            blockEndAt: null,
          },
          live: true,
        },
      ],
    },
  },
};

export const WithNewActivity: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      hasNewActivity: true,
    },
  },
};

export const HighEngagement: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'High Engagement Proposal - Treasury Management Reform',
      authorName: 'Entropy',
      authorAvatarUrl:
        'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/entropy/96/9769_2.png',
      votesCount: 5432,
      postsCount: 127,
      hasNewActivity: true,
    },
  },
};

export const LowEngagement: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Simple Configuration Update',
      votesCount: 45,
      postsCount: 8,
      hasNewActivity: false,
    },
  },
};

export const NoFeedData: Story = {
  args: {
    ...Default.args,
    feedData: null,
  },
};

export const LongTitle: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'This is a very long proposal title that should demonstrate how the component handles text wrapping and truncation when the title exceeds the available space in the component layout',
    },
  },
};

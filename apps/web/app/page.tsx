// Homepage redirects to arbitrum subdomain via Next.js config redirects
// This page should not be reached due to the redirect in next.config.mjs

// Original homepage implementation preserved below for future reference:
/*
import {
  Hero,
  FeatureSection,
  PledgeSection,
  FinalSection,
  Navigation,
} from '@/app/(marketing)/components/landing';
import { FullPageSection } from '@/app/(marketing)/components/landing/FullPageSection';

export default async function Page() {
  return (
    <>
      {/* Under Construction Banner *\/}
      <div className='fixed top-0 right-0 left-0 z-50 bg-amber-500 px-4 py-2 text-center font-medium text-black'>
        <span className='text-sm'>🚧 This page is under construction. 🚧</span>
      </div>

      <Navigation />
      <main className='h-screen-safe snap-y snap-proximity overflow-x-hidden overflow-y-auto sm:snap-mandatory'>
        {/* Hero Section - Light *\/}
        <FullPageSection className='bg-stone-50' data-theme='light'>
          <Hero />
        </FullPageSection>

        {/* Feature 1: Unified Proposal Page - Dark *\/}
        <FullPageSection className='bg-zinc-900' data-theme='dark'>
          <FeatureSection
            title='Unified Proposal Page'
            description='Everything about a proposal in one place. Discourse discussion, Snapshot votes and onchain votes unified.'
            points={[
              'All governance activity aggregated',
              'Cross-platform proposal tracking',
              'Single source of truth for decisions',
              'Historical context and timeline',
            ]}
            gifUrl='/unified-proposal-demo.gif'
            theme='dark'
          />
        </FullPageSection>

        {/* Feature 2: Live Votes - Light *\/}
        <FullPageSection className='bg-stone-100' data-theme='light'>
          <FeatureSection
            title='Live Voting Results'
            description="Track voting progress in real-time with detailed analytics. See how delegates vote, when they vote, and who hasn't voted yet."
            points={[
              'Real-time voting charts showing cumulative progress',
              'Complete voter breakdown with ENS names and voting power',
              'Non-voter tracking for major delegates',
              'Historical voting power at time of vote vs current power',
            ]}
            gifUrl='/live-votes-demo.gif'
            reverse
            theme='light'
          />
        </FullPageSection>

        {/* Feature 3: Email Notifications - Dark *\/}
        <FullPageSection className='bg-zinc-800' data-theme='dark'>
          <FeatureSection
            title='Proposal Notification Emails'
            description='Subscribe to email notifications, receiving an email every time a new discussion is started, when an offchain or onchain vote begins, and when its voting period is nearing completion.'
            points={[
              'New proposal announcements',
              'Vote starting reminders',
              'Deadline alerts before votes close',
              'Customizable notification settings',
            ]}
            gifUrl='/email-notifications-demo.gif'
            theme='dark'
          />
        </FullPageSection>

        {/* Feature 4: Discourse Live Status - Light *\/}
        <FullPageSection className='bg-stone-50' data-theme='light'>
          <FeatureSection
            title='Discourse Live Status'
            description='See live voting results right in the forum. No need to leave the discussion to check how a vote is going.'
            points={[
              'Real-time vote count at the top of each proposal',
              'Visual progress bar shows with votes',
              'One-click access to cast your vote',
              'Know when voting ends without leaving the page',
            ]}
            gifUrl='/discourse-status-demo.gif'
            reverse
            theme='light'
          />
        </FullPageSection>

        {/* Feature 5: Voting Power Tags - Dark *\/}
        <FullPageSection className='bg-zinc-900' data-theme='dark'>
          <FeatureSection
            title='Voting Power Tags'
            description="See who has voting power in forum discussions. Know instantly whether you're reading comments from major delegates or regular community members."
            points={[
              'Voting power displayed below every username',
              'Identify influential delegates at a glance',
              'Track how voting power changes over time',
              'Better context for governance discussions',
            ]}
            gifUrl='/voting-power-demo.gif'
            theme='dark'
          />
        </FullPageSection>

        {/* Pledge Section - Dark *\/}
        <FullPageSection className='bg-zinc-950' data-theme='dark'>
          <PledgeSection />
        </FullPageSection>

        {/* Final CTA Section - Dark *\/}
        <FullPageSection className='bg-zinc-900' data-theme='dark'>
          <FinalSection />
        </FullPageSection>
      </main>
    </>
  );
}
*/

export default function Page() {
  return <div></div>;
}

import { searchParamsCache } from '@/app/searchParams';
import { notFound } from 'next/navigation';
import {
  VersionType,
  getGroup_cached,
  getTotalVersions_cached,
  getBodies_cached,
  getFeed,
} from './actions';
import Body from './components/body/Body';
import Feed from './components/feed/Feed';
import { MenuBar } from './components/menubar/MenuBar';
import { Timeline } from './components/timeline/Timeline';

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;

  const [group, totalVersions, bodies] = await Promise.all([
    getGroup_cached(daoSlug, groupId),
    getTotalVersions_cached(groupId),
    getBodies_cached(groupId),
  ]);

  if (!group || !totalVersions || !bodies) {
    notFound();
  }

  const {
    version,
    feed: feedFilter,
    votes: votesFilter,
    diff,
  } = await searchParamsCache.parse(searchParams);

  // Always use the latest version if no version is specified
  const currentVersion = version ?? totalVersions - 1;

  // Extract just the version types
  const versionTypes: VersionType[] = bodies.map((body) => body.type);

  const feed = await getFeed(group.group.id, feedFilter, votesFilter);

  return (
    <div className='flex w-full flex-col items-center pt-10'>
      <div className='flex max-w-3xl flex-col overflow-visible'>
        <Body
          group={group}
          version={currentVersion}
          diff={diff}
          bodies={bodies}
        />

        <MenuBar
          totalVersions={totalVersions}
          versionTypes={versionTypes}
          currentVersion={currentVersion}
          includesProposals={group.proposals.length > 0}
        />

        <Feed group={group} feed={feed} />
      </div>

      <Timeline
        events={feed.events}
        group={group}
        feedFilter={feedFilter}
        votesFilter={votesFilter}
      />
    </div>
  );
}

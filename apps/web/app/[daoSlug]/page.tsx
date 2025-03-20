import { ProposalGroupItem } from '@/lib/types';
import { getGroupHeader, getGroups } from './actions';
import { GroupItem } from './components/GroupItem';

export default async function ListPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  const result = await getGroups(daoSlug);

  if (!result) {
    return null;
  }

  const { daoName, groups } = result;

  // Fetch author information for each group and transform data to match GroupItem props
  const groupsWithAuthorInfo = await Promise.all(
    groups.map(async (group) => {
      const authorInfo = await getGroupHeader(group.id);

      // Count the number of proposals and comments within the group
      const items = group.items as ProposalGroupItem[];
      const proposalsCount = items.filter(
        (item) => item.type === 'proposal'
      ).length;
      const commentsCount = items.filter(
        (item) => item.type === 'topic'
      ).length;

      return {
        id: group.id,
        name: group.name,
        slug: `${group.id}`,
        authorName: authorInfo.originalAuthorName,
        authorAvatarUrl: authorInfo.originalAuthorPicture,
        latestActivityAt: new Date(group.newestActivityTimestamp),
        hasNewActivity: group.hasNewActivity,
        commentsCount,
        proposalsCount,
      };
    })
  );

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='w-full p-8'>
        <h1 className='mb-8 text-4xl font-bold text-neutral-700 dark:text-neutral-200'>
          {daoName || daoSlug}
        </h1>
        <div className='space-y-4'>
          {groupsWithAuthorInfo.map((group) => (
            <GroupItem key={group.id} group={group} />
          ))}
        </div>
      </div>
    </div>
  );
}

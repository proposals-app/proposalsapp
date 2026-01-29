import { ImageResponse } from 'next/og';
import { getGroupHeaderCached } from './actions';

export const alt = 'Proposal details';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const headerInfo = await getGroupHeaderCached(groupId);

  const groupName = headerInfo?.groupName || 'Proposal';
  const authorName = headerInfo?.originalAuthorName || 'Unknown';

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '90%',
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: 56,
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: 24,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {groupName}
          </div>
          <div
            style={{
              color: '#a0a0a0',
              fontSize: 28,
              marginTop: 12,
            }}
          >
            by {authorName}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              color: '#6b7280',
              fontSize: 24,
            }}
          >
            proposals.app
          </div>
        </div>
      </div>
    ),
    size
  );
}

interface VolumeEventProps {
  timestamp?: Date;
  width: number;
  last?: boolean;
  index?: number;
  type: 'comments' | 'votes';
  // For vote volume events
  volumes?: number[]; // Array of volumes by choice
  colors?: string[]; // Array of colors for each choice
  showContent?: boolean;
}

export function VolumeEvent({
  width,
  type,
  volumes,
  colors,
  showContent = true,
}: VolumeEventProps) {
  // For empty placeholder events
  if (!showContent) {
    return <div className='flex min-h-1 w-full items-center'></div>;
  }

  if (type === 'comments') {
    return (
      <div className='flex min-h-1 w-full items-center py-[1px]'>
        <div
          className='ml-4 min-h-1 translate-x-[1px] bg-neutral-300 dark:bg-neutral-700'
          style={{
            width: `${Math.max(width * 80, 1)}%`,
          }}
        />
      </div>
    );
  }

  if (type === 'votes' && volumes && colors) {
    return (
      <div className='flex min-h-1 w-full items-center py-[1px]'>
        <div
          className='ml-4 flex min-h-1 translate-x-[1px]'
          style={{ width: `${Math.max(width * 80, 1)}%` }}
        >
          {/* Render a segment for each choice with volume > 0 */}
          {volumes.map((val, index) => {
            // Skip rendering if no voting power for this choice
            if (val <= 0) return null;

            // Calculate the percentage width of this segment within the total bar
            const segmentWidth = width > 0 ? (val / width) * 100 : 0;

            return (
              <div
                key={index}
                className='min-h-1'
                style={{
                  width: `${segmentWidth}%`,
                  backgroundColor: colors[index] || '#CBD5E1',
                  opacity: 0.75,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback for empty votes volume
  return <div className='flex min-h-1 w-full items-center'></div>;
}

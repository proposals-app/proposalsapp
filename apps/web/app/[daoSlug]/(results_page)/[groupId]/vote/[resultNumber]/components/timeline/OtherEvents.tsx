export function GapEvent() {
  return (
    <div
      className='relative min-h-[40px] w-full'
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className='z-50 ml-30 h-full w-full' />
    </div>
  );
}

export function VotesVolumeEvent() {
  return (
    <div className='flex h-full w-full items-center'>
      <div className='ml-4 min-h-1' />
    </div>
  );
}

export function CommentsVolumeEvent() {
  return (
    <div className='flex h-full w-full items-center'>
      <div className='ml-4 min-h-1' />
    </div>
  );
}

export function BasicEvent() {
  return (
    <div className='relative mr-4 flex h-8 w-full items-center py-2'></div>
  );
}

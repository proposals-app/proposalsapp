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
    ></div>
  );
}

export function VotesVolumeEvent() {
  return <div className='flex min-h-1 w-full items-center'></div>;
}

export function CommentsVolumeEvent() {
  return <div className='flex min-h-1 w-full items-center'></div>;
}

export function BasicEvent() {
  return (
    <div className='relative mr-4 flex min-h-8 w-full items-center py-2'></div>
  );
}

export function GapEvent() {
  return (
    <div
      className='relative min-h-5 w-full'
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className='absolute left-1/2 top-0 h-full w-full -translate-x-1/2 transform dark:hidden'
        style={{
          background: `repeating-linear-gradient(
                     to bottom,
                     transparent,
                     transparent 5px,
                     var(--neutral-50) 5px,
                     var(--neutral-50) 10px
                   )`,
        }}
      />

      <div
        className='absolute left-1/2 top-0 hidden h-full w-full -translate-x-1/2 transform
          dark:block'
        style={{
          background: `repeating-linear-gradient(
                     to bottom,
                     transparent,
                     transparent 5px,
                     var(--neutral-950) 5px,
                     var(--neutral-950) 10px
                   )`,
        }}
      />
    </div>
  );
}

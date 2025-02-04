export function GapEvent() {
  return (
    <div className='relative flex h-5 w-full items-center justify-center'>
      <div
        className='absolute top-0 left-1/2 h-full w-full -translate-x-1/2 transform dark:hidden'
        style={{
          background: `repeating-linear-gradient(
                     to bottom,
                     transparent,
                     transparent 4px,
                     var(--neutral-50) 4px,
                     var(--neutral-50) 8px
                   )`,
        }}
      />

      <div
        className='absolute top-0 left-1/2 hidden h-full w-full -translate-x-1/2 transform dark:block'
        style={{
          background: `repeating-linear-gradient(
                     to bottom,
                     transparent,
                     transparent 4px,
                     var(--neutral-950) 4px,
                     var(--neutral-950) 8px
                   )`,
        }}
      />
    </div>
  );
}

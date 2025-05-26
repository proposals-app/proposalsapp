export default async function NotFound() {
  return (
    <div className='flex min-h-screen w-full items-center justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='text-center'>
        <h2 className='text-xl font-semibold text-neutral-700 dark:text-neutral-300'>
          Page Not Found
        </h2>
        <p className='mt-2 text-neutral-600 dark:text-neutral-400'>
          The page you are looking for does not exist.
        </p>
      </div>
    </div>
  );
}

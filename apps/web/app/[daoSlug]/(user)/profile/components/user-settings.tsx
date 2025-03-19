import { auth, Session } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signOut() {
  'use server';
  await auth.api.signOut({ headers: await headers() });
  redirect('/');
}

interface UserDataProps {
  session: Session | null;
}

export const UserData = ({ session }: UserDataProps) => {
  return (
    <div className='flex w-full flex-col items-start p-8'>
      {session?.user ? (
        <div className='w-full max-w-lg'>
          <h2 className='mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100'>
            Your Profile Data
          </h2>
          <div className='flex flex-col gap-2'>
            <p className='text-neutral-700 dark:text-neutral-300'>
              Email: {session.user.email}
            </p>
            <p className='text-neutral-700 dark:text-neutral-300'>
              User ID: {session.user.id}
            </p>
          </div>

          <form action={signOut} className='mt-6'>
            <button
              type='submit'
              className='border-brand-accent bg-brand-accent hover:bg-brand-accent-darker
                dark:bg-brand-accent-bright w-full rounded-md py-2 text-sm font-medium
                text-white transition-colors focus:ring-2 disabled:opacity-50
                dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100
                dark:hover:bg-neutral-700'
            >
              Sign Out
            </button>
          </form>
        </div>
      ) : (
        <div className='w-full'>
          <p className='text-center text-neutral-600 dark:text-neutral-400'>
            Please sign in to view your profile data.
          </p>
        </div>
      )}
    </div>
  );
};

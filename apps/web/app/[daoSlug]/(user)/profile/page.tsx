import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from './components/login-form';
import { UserSettings } from './components/user-settings';
import { AccountManagement } from './components/account-management';
import { LogOutIcon } from 'lucide-react';
import { Suspense } from 'react';

async function signOut() {
  'use server';
  await auth.api.signOut({ headers: await headers() });
  redirect('/');
}

export default async function Page() {
  return (
    <Suspense>
      <ProfilePage />
    </Suspense>
  );
}

async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session && session.user && !session.user.isOnboarded) {
    redirect(`/onboarding`);
  }

  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        {!session && <LoginForm />}

        {session && (
          <main className='w-full py-4 sm:py-6 md:py-10'>
            {/* Welcome Header */}
            <div className='mb-8 text-center'>
              <h1 className='mb-2 text-3xl font-bold text-neutral-800 dark:text-neutral-100'>
                Welcome back,
              </h1>
              <p className='text-primary max-w-full truncate px-2 text-lg font-medium text-neutral-600 dark:text-neutral-400'>
                {session.user.email}
              </p>
            </div>

            {/* Settings Sections */}
            <div id='notifications' className='mb-8'>
              <UserSettings session={session} />
            </div>
            <div id='account' className='mb-8'>
              <AccountManagement session={session} />
            </div>

            {/* Sign Out Button (Centered) */}
            <div id='signout' className='flex justify-end'>
              <form action={signOut}>
                <button
                  type='submit'
                  className='inline-flex items-center justify-center rounded-xs bg-neutral-200 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-neutral-900 hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-50 sm:px-4 sm:py-2 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600'
                >
                  <LogOutIcon className='mr-2 h-4 w-4' />
                  Sign out
                </button>
              </form>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

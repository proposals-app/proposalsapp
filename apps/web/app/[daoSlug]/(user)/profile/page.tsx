import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from './components/login-form';
import { UserSettings } from './components/user-settings';
import { AccountManagement } from './components/account-management';
import { LogOutIcon } from 'lucide-react';

async function signOut() {
  'use server';
  await auth.api.signOut({ headers: await headers() });
  redirect('/');
}

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className='flex h-full w-full flex-col items-center'>
      <div className='flex h-full w-full'>
        <div
          className='border-neutral-350 dark:border-neutral-650 flex h-full w-full items-center
            justify-center border-r bg-neutral-100 dark:bg-neutral-900'
        >
          {!session && <LoginForm />}

          {session && (
            <div className='flex h-full w-full flex-col md:flex-row'>
              {/* Sidebar */}
              <aside
                className='w-full bg-neutral-200 p-4 md:h-full md:w-1/4 md:min-w-[250px]
                  dark:bg-neutral-800'
              >
                <div className='mt-4 w-full px-4 text-center md:mt-8 md:px-0'>
                  <h2 className='mb-2 text-xl font-semibold text-neutral-800 dark:text-neutral-100'>
                    Welcome back,
                  </h2>
                  <p className='text-primary max-w-full truncate px-2 text-lg font-medium'>
                    {session.user.email}
                  </p>
                </div>
              </aside>

              {/* Main content area */}
              <main className='h-full w-full overflow-y-auto p-4 pb-16 md:w-3/4 md:px-8 lg:px-16'>
                <div id='notifications'>
                  <UserSettings session={session} />
                </div>
                <div id='account'>
                  <AccountManagement session={session} />
                </div>

                <div id='signout' className='justify-self-end'>
                  <form action={signOut}>
                    <button
                      type='submit'
                      className='border-input bg-background hover:bg-accent hover:text-accent-foreground
                        focus:ring-ring inline-flex items-center justify-center border px-6 py-2 text-sm
                        font-medium transition-colors focus:ring-2 focus:ring-offset-2
                        focus:outline-none disabled:opacity-50'
                    >
                      <LogOutIcon className='mr-2 h-4 w-4' />
                      Sign out
                    </button>
                  </form>
                </div>
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

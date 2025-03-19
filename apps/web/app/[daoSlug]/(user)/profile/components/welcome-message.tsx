import { auth } from '@/lib/auth';
import { LogOutIcon } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

interface WelcomeMessageProps {
  user: any;
}

export async function signOut() {
  'use server';
  await auth.api.signOut({ headers: await headers() });
  redirect('/');
}

export async function WelcomeMessage({ user }: WelcomeMessageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className='bg-card text-card-foreground w-full max-w-md rounded-lg border shadow-sm'>
      <div className='flex flex-col space-y-1.5 p-6'>
        <h3 className='text-2xl leading-none font-semibold tracking-tight'>
          Welcome!
        </h3>
        <p className='text-muted-foreground text-sm'>
          You're signed in as {user.email}
        </p>
      </div>

      <div className='flex p-6 pt-0'>
        <form action={signOut} className='mt-6 w-full'>
          <button
            type='submit'
            className='border-input bg-background hover:bg-accent hover:text-accent-foreground
              focus:ring-ring data-[state=open]:bg-accent-foreground
              data-[state=open]:text-accent inline-flex items-center justify-center rounded-md
              border px-8 py-2 text-sm font-medium transition-colors focus:ring-2
              focus:ring-offset-2 focus:outline-none disabled:opacity-50'
          >
            <LogOutIcon className='mr-2 h-4 w-4' />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

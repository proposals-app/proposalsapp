import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { LoginForm } from './components/login-form';
import { UserData } from './components/user-data';
import { WelcomeMessage } from './components/welcome-message';

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className='flex h-full w-full flex-col items-center'>
      <div className='flex h-full w-full'>
        <div
          className='border-neutral-350 dark:border-neutral-650 flex h-full w-full items-center
            justify-center border-r bg-neutral-100 dark:bg-neutral-900'
        >
          {!session && <LoginForm session={session} />}
          {session && <WelcomeMessage user={session?.user} />}
        </div>
      </div>
    </div>
  );
}

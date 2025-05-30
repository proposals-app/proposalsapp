import { auth } from '@/lib/auth/arbitrum_auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { EmailPreferences } from './components/email-preferences';

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/');
  }

  return <EmailPreferences />;
}

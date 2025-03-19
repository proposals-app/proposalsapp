'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function saveSettings(formData: FormData) {
  const newDiscussions = formData.get('newDiscussions') === 'on';
  const newProposals = formData.get('newProposals') === 'on';
  const dailyRoundup = formData.get('dailyRoundup') === 'on';

  await auth.api.updateUser({
    body: {
      emailSettingsNewProposals: newDiscussions,
      emailSettingsNewDiscussions: newProposals,
      emailSettingsDailyRoundup: dailyRoundup,
    },
    headers: await headers(),
  });

  // Simulate saving settings to a database or preferences
  console.log('Saving settings:', {
    newDiscussions,
    newProposals,
    dailyRoundup,
  });

  // In a real application, you would update user preferences here.
  // For example:
  // await prisma.userSettings.update({
  //   where: { userId: session.user.id }, // Assuming you have user ID in session
  //   data: { newDiscussions, newProposals, dailyRoundup },
  // });

  // Return success or some data if needed
  return { success: true };
}

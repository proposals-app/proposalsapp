'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export interface SettingsData {
  newDiscussions: boolean;
  newProposals: boolean;
  dailyRoundup: boolean;
  isOnboarded: boolean;
}

export async function saveSettings(settings: SettingsData) {
  const { newDiscussions, newProposals, dailyRoundup, isOnboarded } = settings;

  await auth.api.updateUser({
    body: {
      emailSettingsNewProposals: newProposals,
      emailSettingsNewDiscussions: newDiscussions,
      emailSettingsDailyRoundup: dailyRoundup,
      isOnboarded: isOnboarded,
    },
    headers: await headers(),
  });

  // Simulate saving settings to a database or preferences
  console.log('Saving settings:', {
    newDiscussions,
    newProposals,
    dailyRoundup,
    isOnboarded,
  });

  // Return success or some data if needed
  return { success: true };
}

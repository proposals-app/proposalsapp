'use server';

import { auth } from '@/lib/auth';
import { settingsSchema } from '@/lib/validations';
import { headers } from 'next/headers';

export interface SettingsData {
  newDiscussions: boolean;
  newProposals: boolean;
  endingProposals: boolean;
  isOnboarded: boolean;
}

export async function saveSettings(settings: SettingsData) {
  settingsSchema.parse(settings);

  const { newDiscussions, newProposals, endingProposals, isOnboarded } =
    settings;

  await auth.api.updateUser({
    body: {
      emailSettingsNewProposals: newProposals,
      emailSettingsNewDiscussions: newDiscussions,
      emailSettingsEndingProposals: endingProposals,
      isOnboarded: isOnboarded,
    },
    headers: await headers(),
  });

  // Return success or some data if needed
  return { success: true };
}

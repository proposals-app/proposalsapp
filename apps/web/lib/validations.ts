import { z } from 'zod/v4';

// Common schemas
export const daoSlugSchema = z.literal(['arbitrum', 'uniswap'], {
  message: 'DAO slug must be valid.',
});
export const daoIdSchema = z.uuid({ message: 'Must be a valid UUID.' });
export const groupIdSchema = z.uuid({ message: 'Must be a valid UUID.' });
export const discourseUserIdSchema = z
  .number()
  .refine((value) => (value >= 1 && value <= 100000) || value === -1, {
    message: 'Discourse User ID must be between 1 and 100000, or -1.',
  });
export const daoDiscourseIdSchema = z.uuid({
  message: 'Must be a valid UUID.',
});
export const proposalIdSchema = z.uuid({ message: 'Must be a valid UUID.' });
export const voterAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message: 'Must be a valid Ethereum address.',
});

export const settingsSchema = z.object({
  newDiscussions: z.boolean({
    error: 'New discussions setting is required.',
  }),
  newProposals: z.boolean({
    error: 'New proposals setting is required.',
  }),
  endingProposals: z.boolean({
    error: 'Ending proposals setting is required.',
  }),
  isOnboarded: z.boolean({
    error: 'Onboarded status is required.',
  }),
});

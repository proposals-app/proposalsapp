import { z } from 'zod';

// Common schemas
export const daoSlugSchema = z.literal('arbitrum', {
  message: 'DAO slug must be arbitrum.',
});
export const daoIdSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID.' });
export const groupIdSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID.' });
export const discourseUserIdSchema = z
  .number()
  .min(1, { message: 'Discourse User ID must be at least 1.' })
  .max(100000, { message: 'Discourse User ID must be no more than 100000.' });
export const daoDiscourseIdSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID.' });
export const proposalIdSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID.' });
export const voterAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message: 'Must be a valid Ethereum address.',
});

export const settingsSchema = z.object({
  newDiscussions: z.boolean({
    required_error: 'New discussions setting is required.',
    invalid_type_error: 'New discussions setting must be a boolean.',
  }),
  newProposals: z.boolean({
    required_error: 'New proposals setting is required.',
    invalid_type_error: 'New proposals setting must be a boolean.',
  }),
  dailyRoundup: z.boolean({
    required_error: 'Daily roundup setting is required.',
    invalid_type_error: 'Daily roundup setting must be a boolean.',
  }),
  isOnboarded: z.boolean({
    required_error: 'Onboarded status is required.',
    invalid_type_error: 'Onboarded status must be a boolean.',
  }),
});

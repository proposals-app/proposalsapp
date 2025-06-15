// Action controller for dynamic mocking in Storybook
import { mockDiscourseUser, mockDelegate } from '../mock-data';

// This object holds the mock functions. We will override these in our stories.
export const actionController = {
  getDiscourseUser: async (userId: string, daoDiscourseId: string) => {
    console.log('Mock getDiscourseUser called with:', userId, daoDiscourseId);
    return mockDiscourseUser;
  },

  getPostLikesCount: async (externalId: string, daoDiscourseId: string) => {
    console.log(
      'Mock getPostLikesCount called with:',
      externalId,
      daoDiscourseId
    );
    return 42; // Default mock likes count
  },

  getDelegateByDiscourseUser: async (
    userId: string,
    daoSlug: string,
    includeLatest: boolean,
    topicIds: number[],
    proposalIds: string[]
  ) => {
    console.log('Mock getDelegateByDiscourseUser called with:', {
      userId,
      daoSlug,
      includeLatest,
      topicIds,
      proposalIds,
    });
    return mockDelegate;
  },
};

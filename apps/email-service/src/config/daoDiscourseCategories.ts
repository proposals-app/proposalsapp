/**
 * Configuration for which Discourse categories trigger email notifications for each DAO.
 * If a DAO is not listed here, all categories will trigger notifications.
 */
export const DAO_DISCOURSE_CATEGORIES: Record<string, number[]> = {
  arbitrum: [7, 8],
  // Add more DAOs and their allowed categories here as needed
  // example: uniswap: [1, 2, 3],
};

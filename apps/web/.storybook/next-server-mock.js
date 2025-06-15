// Mock for next/server to avoid server dependencies in Storybook

export async function connection() {
  // Mock connection function that does nothing in Storybook
  return Promise.resolve();
}
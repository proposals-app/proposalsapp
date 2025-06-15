// Mock for next/server
export const connection = () => {
  console.log('Mock `connection()` from next/server called.');
  return Promise.resolve({}); // Return a promise as the real connection() does
};

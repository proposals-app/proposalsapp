import { auth } from '@/lib/auth/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Create a single handler for unified auth
const handler = toNextJsHandler(auth.handler);

// Export the GET and POST handlers
export const { GET, POST } = handler;

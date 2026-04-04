import { dbPool } from '@proposalsapp/db';

export interface ClosableServer {
  close(callback?: (error?: Error) => void): unknown;
}

function closeServer(server: ClosableServer | null): Promise<void> {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function closeMappingAgentResources(
  server: ClosableServer | null
): Promise<void> {
  await Promise.all([closeServer(server), dbPool.end()]);
}

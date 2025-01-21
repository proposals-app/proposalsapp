'use client';

import { validateRequest } from '@/lib/auth';
import { createContext, useContext } from 'react';

type ContextType = Awaited<ReturnType<typeof validateRequest>>;

const SessionContext = createContext<ContextType>({
  session: null,
  user: null,
});

export function SessionProvider({
  value,
  children,
}: {
  value: ContextType;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export function useSession(): ContextType {
  return useContext(SessionContext);
}

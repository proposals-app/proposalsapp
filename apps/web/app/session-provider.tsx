"use client";

import { createContext, useContext } from "react";
import type { validateRequest } from "../server/auth";

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

import { ReactNode } from "react";

export default function ResultLayout({ children }: { children: ReactNode }) {
  return <div className="pl-20">{children}</div>;
}

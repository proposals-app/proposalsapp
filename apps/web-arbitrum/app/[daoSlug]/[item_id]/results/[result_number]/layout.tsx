import { ReactNode } from "react";

export default async function ResultLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="w-full pl-20">{children}</div>;
}

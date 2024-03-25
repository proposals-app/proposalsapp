export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex grow flex-col">{children}</div>;
}

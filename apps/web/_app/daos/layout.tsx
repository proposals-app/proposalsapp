import { Header } from "../components/header";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1E1B20] flex flex-col">
      <Header title="DAOs" />

      <div className="p-5 lg:p-10 flex min-h-screen w-full grow flex-col">
        {children}
      </div>
    </div>
  );
}

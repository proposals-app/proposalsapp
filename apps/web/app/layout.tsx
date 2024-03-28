import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { NavBar } from "./components/nav-bar";
import { validateRequest } from "@/lib/auth";
import { SessionProvider } from "./components/session-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? "https://proposals.app"),
  title: "proposals.app",
  description:
    "The place where you can find all the \ud83d\udd25 and \ud83c\udf36 info from your favorite DAOs.",
  icons: ["favicon.ico"],
  manifest: "/manifest.json",
  authors: [
    { name: "Paulo Fonseca", url: "https://paulofonseca.com" },
    {
      name: "Andrei Voinea",
      url: "https://andreiv.com",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "light",
  minimumScale: 1,
  initialScale: 1,
  width: "device-width",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateRequest();

  return (
    <html lang="en">
      <body>
        <SessionProvider value={session}>
          <div className="h-full min-h-screen w-full flex flex-col items-center bg-luna">
            <div className="w-full max-w-6xl flex flex-col pt-14 pb-40 gap-12">
              <NavBar />
              {children}
            </div>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}

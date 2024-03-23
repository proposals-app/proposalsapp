import "../styles/globals.css";
import { NavBar } from "./components/nav-bar";
import type { Metadata, Viewport } from "next";
import { validateRequest } from "../server/auth";
import { SessionProvider } from "./session-provider";

// Metadata for the app
export const metadata: Metadata = {
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
  openGraph: {
    images: [`${process.env.WEB_URL}/api/og/home`],
  },
};

export const viewport: Viewport = {
  themeColor: "dark",
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
    <html lang="en" className="bg-[#000000]">
      <body>
        <SessionProvider value={session}>
          <div className="h-full min-h-screen w-full">
            <div className="flex h-full min-h-screen w-full flex-row">
              <div className="hidden lg:flex">
                <NavBar />
              </div>
              <div className="w-full">{children}</div>
            </div>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}

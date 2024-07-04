import { validateRequest } from "@/lib/auth";
import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import OnboardingFlow from "./components/onboarding/onboarding";
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
      <body className="bg-[#F1EBE7]">
        <SessionProvider value={session}>
          <OnboardingFlow />
          <div className="flex h-full min-h-screen w-full flex-col items-center bg-luna">
            <div className="flex w-full flex-col gap-12 px-4 pb-40 pt-14 lg:max-w-[1200px]">
              {children}
            </div>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}

import { validateRequest } from "@/lib/auth";
import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { SessionProvider } from "./providers/session-provider";
import dynamic from "next/dynamic";
import { PHProvider } from "./providers/posthog-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "./providers/theme-provider";
import { ModeToggle } from "./components/theme-switch";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? "https://proposals.app"),
  title: "proposals.app",
  applicationName: "proposals.app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "proposals.app",
  },
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

const PostHogPageView = dynamic(
  () => import("./providers/posthog-pageview"),
  {},
);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateRequest();

  return (
    <html lang="en" suppressHydrationWarning>
      <SessionProvider value={session}>
        <NuqsAdapter>
          <PHProvider>
            <body>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <PostHogPageView />

                <div className="absolute right-4 top-4 z-50">
                  <ModeToggle />
                </div>

                <div>{children}</div>
              </ThemeProvider>
            </body>
          </PHProvider>
        </NuqsAdapter>
      </SessionProvider>
    </html>
  );
}

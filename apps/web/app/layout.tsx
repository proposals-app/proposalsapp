import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { NavBar } from "./components/nav-bar";

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
  return (
    <html lang="en">
      <body>
        <div className="h-full min-h-screen w-full">
          <div className="w-full flex flex-col items-center">
            <NavBar />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

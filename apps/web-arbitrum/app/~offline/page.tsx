import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
};

export default function Page() {
  return (
    <>
      <h1>Oops</h1>
      <h2>Looks like we are offline</h2>
    </>
  );
}

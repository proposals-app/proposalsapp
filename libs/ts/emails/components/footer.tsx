import { Text, Link } from "@react-email/components";
import * as React from "react";

export const Footer = () => {
  return (
    <Text className="mt-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
      &copy; {new Date().getFullYear()} proposals.app.
      <br />
      <Link
        href="https://proposals.app/privacy"
        className="text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        Privacy Policy
      </Link>{" "}
      •{" "}
      <Link
        href="https://proposals.app/terms"
        className="text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        Terms of Service
      </Link>
    </Text>
  );
};

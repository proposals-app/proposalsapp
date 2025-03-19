import { Text, Link } from "@react-email/components";
import * as React from "react";

export const Footer = () => {
  return (
    <Text className="text-center text-xs text-gray-500">
      &copy; {new Date().getFullYear()} proposals.app. All rights reserved.
      <br />
      <Link
        href="https://proposals.app/privacy"
        className="text-blue-600 underline"
      >
        Privacy Policy
      </Link>{" "}
      •{" "}
      <Link
        href="https://proposals.app/terms"
        className="text-blue-600 underline"
      >
        Terms of Service
      </Link>
    </Text>
  );
};

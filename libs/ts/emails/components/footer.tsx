import { Text, Link } from "@react-email/components";
import * as React from "react";

export const Footer = () => {
  return (
    <Text className="mt-8 text-center text-xs text-gray-500">
      &copy; {new Date().getFullYear()} proposals.app.
      <br />
      <Link
        href="https://proposals.app/privacy"
        className="text-blue-600 hover:text-blue-800"
      >
        Privacy Policy
      </Link>{" "}
      •{" "}
      <Link
        href="https://proposals.app/terms"
        className="text-blue-600 hover:text-blue-800"
      >
        Terms of Service
      </Link>
    </Text>
  );
};

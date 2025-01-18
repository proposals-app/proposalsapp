"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "./session-provider";

export const PostHogIdentifier = () => {
  const posthog = usePostHog();
  const { user } = useSession();

  useEffect(() => {
    if (user && user?.emailVerified) posthog.identify(user.email);
  }, [user, posthog]);

  return <></>;
};

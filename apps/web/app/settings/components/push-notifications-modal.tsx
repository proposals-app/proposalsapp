"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shadcn/ui/alert-dialog";
import { Manjari, Poppins } from "next/font/google";
import Image from "next/image";
import { cn } from "@/shadcn/lib/utils";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/shadcn/ui/button";
import { removePushNotifications, setPushNotifications } from "../actions";
import { LuShare, LuPlus } from "react-icons/lu";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

const poppins300 = Poppins({
  weight: "300",
  subsets: ["latin"],
});

const poppins700 = Poppins({
  weight: "700",
  subsets: ["latin"],
});

export const PushNotificationsModal = () => {
  const [open, setOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const subscribeButtonOnClick = async () => {
    if (!process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY) {
      throw new Error("Environment variables supplied not sufficient.");
    }
    if (!registration) {
      console.error("No SW registration available.");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
    });

    await setPushNotifications(
      JSON.stringify({
        subscription,
      }),
    );
    setSubscription(subscription);
    setIsSubscribed(true);
  };

  const unsubscribeButtonOnClick = async () => {
    if (!subscription) {
      console.error("Web push not subscribed");
      return;
    }

    const subscriptionEndpoint = subscription.endpoint;

    await subscription.unsubscribe();

    await removePushNotifications(subscriptionEndpoint);
    setSubscription(null);
    setIsSubscribed(false);
  };

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.serwist !== undefined
    ) {
      // run only in browser
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (
            sub &&
            !(
              sub.expirationTime &&
              Date.now() > sub.expirationTime - 5 * 60 * 1000
            )
          ) {
            setSubscription(sub);
            setIsSubscribed(true);
          }
        });
        setRegistration(reg);
      });
    }
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [isSubscribed]);

  return (
    <AlertDialog open={open}>
      <AlertDialogTrigger asChild>
        <Button
          className={`${manjari.className} block h-[42px] w-fit rounded-lg border-2 border-gold bg-luna text-center text-gold lg:hidden lg:h-[56px]`}
          onClick={() => setOpen(!open)}
        >
          <p className="text-[24px] leading-[32px] lg:leading-[46px]">
            push notifications
          </p>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent
        className={cn(
          `flex h-screen w-full flex-col items-center bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:min-h-[400px] lg:max-w-2xl lg:rounded-3xl lg:p-12`,
        )}
      >
        <AlertDialogCancel
          asChild
          className={cn(
            buttonVariants({ variant: "default" }),
            "m-0 rounded-full bg-transparent p-0 hover:bg-transparent",
          )}
        >
          <Image
            className="absolute left-4 top-12 h-[48px] w-[48px] cursor-pointer lg:left-2 lg:top-2"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
            onClick={() => {
              setOpen(!open);
            }}
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
          />
        </AlertDialogCancel>

        <div className="flex flex-col justify-start">
          <AlertDialogTitle
            className={`text-center text-[36px] leading-[48px] ${manjari.className}`}
          >
            Get push notifications
          </AlertDialogTitle>

          {registration ? (
            <AlertDialogDescription
              className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className} py-4`}
            >
              Would you like to receive push notifications when a proposal is
              about to close and you haven&apos;t cast your vote yet?
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription
              className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className} py-4`}
            >
              <div className="flex flex-col items-center gap-12">
                <p>Please add app to screen first.</p>
                <div className="flex flex-col">
                  <div
                    className={`flex flex-row items-center gap-2 text-[18px] leading-[26px] text-dark ${poppins300.className} py-4`}
                  >
                    <LuShare size={50} />
                    <p>Open the share menu</p>
                  </div>

                  <div
                    className={`flex flex-row items-center gap-2 text-[18px] leading-[26px] text-dark ${poppins300.className} py-4`}
                  >
                    <LuPlus size={50} />
                    <p>Add to Home Screen</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          )}
          {isSubscribed && (
            <AlertDialogDescription
              className={`text-center text-[24px] leading-[32px] text-dark ${poppins700.className} py-4`}
            >
              You are subscribed to push notifications! 🎉
            </AlertDialogDescription>
          )}
        </div>
        {isSubscribed ? (
          <Button
            className={`mb-20 mt-auto min-h-[60px] w-full bg-luna text-[24px] font-bold leading-[36px] text-dark underline hover:bg-luna disabled:bg-gold lg:mb-0 ${poppins300.className}`}
            onClick={(e) => {
              e.preventDefault();
              unsubscribeButtonOnClick();
            }}
            disabled={!registration}
          >
            disable notifications
          </Button>
        ) : (
          <Button
            className={`mb-20 mt-auto min-h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold lg:mb-0 ${poppins700.className}`}
            onClick={(e) => {
              e.preventDefault();
              subscribeButtonOnClick();
            }}
            disabled={!registration}
          >
            Yes!
          </Button>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

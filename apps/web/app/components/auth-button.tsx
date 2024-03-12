"use client";

import { useSession } from "../session-provider";
import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import React, { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default async function AuthButton() {
  const { user } = useSession();
  const router = useRouter();

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  return (
    <div className="w-24">
      {!user && <SignIn />}

      {user && (
        <button
          className="w-24 bg-white text-black p-2 text-center text-lg"
          onClick={() => {
            signOut().then(() => router.push("/"));
          }}
        >
          Sign out
        </button>
      )}
    </div>
  );
}

const SignIn = () => {
  enum Page {
    EMAIL,
    CODE,
  }

  const router = useRouter();
  const [page, setPage] = useState(Page.EMAIL);
  const signIn = async (email: string) => {
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const verify = async (code: string) => {
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code }),
      });
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button className="w-full bg-white text-black items-center justify-center font-normal leading-none p-2 text-lg">
            Sign In
          </button>
        </Dialog.Trigger>
        {page == Page.EMAIL && (
          <Dialog.Portal>
            <Dialog.Overlay className="bg-[#1E1B20] bg-opacity-75 data-[state=open]:animate-overlayShow fixed inset-0" />
            <Dialog.Content className="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] bg-black p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
              <Dialog.Title className="text-white m-0 text-[17px] font-medium">
                Welcome to proposals.app
              </Dialog.Title>
              <Dialog.Description className="text-white mt-[10px] mb-5 text-[15px] leading-normal">
                Sign in with your email to get started
              </Dialog.Description>

              <form
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  if (formData.has("email")) {
                    signIn(formData.get("email") as string);
                    setPage(Page.CODE);
                  }
                }}
              >
                <fieldset className="mb-[15px] flex items-center gap-5">
                  <input
                    className="text-black inline-flex h-[35px] w-full flex-1 items-center justify-center px-[10px] text-[15px] leading-none"
                    type="text"
                    name="email"
                    placeholder="delegate@defi.com"
                  />
                </fieldset>

                <div className="mt-[25px] flex justify-center">
                  <button
                    className="bg-white text-black h-[35px] px-[10px]"
                    type="submit"
                  >
                    Continue
                  </button>
                </div>
              </form>
              <Dialog.Close asChild>
                <button
                  className="text-white absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center"
                  aria-label="Close"
                >
                  <Cross2Icon />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        )}
        {page == Page.CODE && (
          <Dialog.Portal>
            <Dialog.Overlay className="bg-[#1E1B20] bg-opacity-75 data-[state=open]:animate-overlayShow fixed inset-0" />
            <Dialog.Content className="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] bg-black p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
              <Dialog.Title className="text-white m-0 text-[17px] font-medium">
                Let&apos;s verify your email
              </Dialog.Title>
              <Dialog.Description className="text-white mt-[10px] mb-5 text-[15px] leading-normal">
                Check your inbox for the code we sent you
              </Dialog.Description>

              <form
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  if (formData.has("code")) {
                    verify(formData.get("code") as string).then(() =>
                      router.refresh(),
                    );
                  }
                }}
              >
                <fieldset className="mb-[15px] flex items-center gap-5">
                  <input
                    className="text-black inline-flex h-[35px] w-full flex-1 items-center justify-center px-[10px] text-[15px] leading-none"
                    type="text"
                    autoComplete="one-time-code"
                    name="code"
                    placeholder="000000"
                  />
                </fieldset>

                <div className="mt-[25px] flex justify-center">
                  <button
                    className="bg-white text-black h-[35px] px-[10px]"
                    type="submit"
                  >
                    Continue
                  </button>
                </div>
              </form>
              <Dialog.Close asChild>
                <button
                  className="text-white absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center"
                  aria-label="Close"
                >
                  <Cross2Icon />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </>
  );
};

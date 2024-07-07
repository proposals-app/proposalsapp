"use client";

import { Button } from "@/shadcn/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/shadcn/ui/alert-dialog";
import { Input } from "@/shadcn/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/shadcn/ui/form";
import { Manjari, Poppins } from "next/font/google";
import { onboardingAddVoter } from "./actions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
const ensDomainRegex = /^(?=.{3,255}$)([a-zA-Z0-9-]+\.)+eth$/;

const VoterFormSchema = z.object({
  address: z
    .string()
    .refine(
      (value) => ethereumAddressRegex.test(value) || ensDomainRegex.test(value),
      {
        message: "Must be a valid Ethereum address or ENS domain name",
      },
    ),
});

export const OnboardingVoterModal = ({ open }: { open: boolean }) => {
  const [isValid, setIsValid] = useState(false);
  const voterForm = useForm<z.infer<typeof VoterFormSchema>>({
    resolver: zodResolver(VoterFormSchema),
    defaultValues: {
      address: "",
    },
  });

  const router = useRouter();

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleVoterAddressChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    voterForm.setValue("address", e.target.value);
    const isValid = await voterForm.trigger("address");
    setIsValid(isValid);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className={cn(
          `flex h-screen w-full flex-col items-center bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:min-h-[400px] lg:max-w-2xl lg:rounded-3xl lg:p-12`,
        )}
      >
        <AlertDialogCancel asChild>
          <Image
            className="absolute left-4 top-12 h-[48px] w-[48px] cursor-pointer lg:left-2 lg:top-2"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
            onClick={() => {
              signOut().then(() => router.refresh());
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
            Add your voting wallet address
          </AlertDialogTitle>
          <AlertDialogDescription
            className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className}`}
          >
            so you can get email notifications showing if you’ve already voted
            or not
          </AlertDialogDescription>
        </div>

        <Form {...voterForm}>
          <form action={onboardingAddVoter} className="flex h-full flex-col">
            <FormField
              control={voterForm.control}
              name="address"
              render={({ field }) => (
                <FormItem className="my-8 flex h-full flex-col justify-start gap-4">
                  <FormControl>
                    <Input
                      className={cn(
                        "h-[60px] border-gold bg-luna text-[18px] lowercase leading-[24px] focus:border-0 focus:bg-white",
                      )}
                      placeholder="0x... or proposalsapp.eth"
                      {...field}
                      value={field.value}
                      onChange={handleVoterAddressChange}
                    />
                  </FormControl>

                  <AlertDialogDescription
                    className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className}`}
                  >
                    You can paste a wallet address or an ENS name
                  </AlertDialogDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className={`mb-20 mt-auto min-h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold lg:mb-0 ${poppins700.className}`}
              type="submit"
              disabled={!isValid}
            >
              Success!
            </Button>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
};

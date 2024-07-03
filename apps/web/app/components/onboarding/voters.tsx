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

const voterFormSchema = z.object({
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
  const voterForm = useForm<z.infer<typeof voterFormSchema>>({
    resolver: zodResolver(voterFormSchema),
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

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className={cn(
          `bg-luna w-full lg:max-w-[40%] px-16 py-12 rounded-3xl sm:rounded-3xl`,
        )}
      >
        <AlertDialogCancel
          asChild
          onClick={() => {
            signOut().then(() => router.refresh());
          }}
        >
          <Image
            className="absolute m-2 w-8 h-8 sm:w-12 sm:h-12"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
          />
        </AlertDialogCancel>
        <Form {...voterForm}>
          <form action={onboardingAddVoter}>
            <FormField
              control={voterForm.control}
              name="address"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-4">
                  <div className="flex flex-col justify-center">
                    <AlertDialogTitle
                      className={`text-center text-4xl ${manjari.className}`}
                    >
                      Add your voting wallet address
                    </AlertDialogTitle>
                    <AlertDialogDescription
                      className={`text-center text-2xl ${poppins300.className}`}
                    >
                      so you can get email notifications showing if you’ve
                      already voted or not
                    </AlertDialogDescription>
                  </div>

                  <FormControl>
                    <Input
                      className="bg-luna border-gold"
                      placeholder="0x... or proposalsapp.eth"
                      {...field}
                    />
                  </FormControl>

                  <AlertDialogDescription
                    className={`text-center leading-8 text-dark ${poppins300.className}`}
                  >
                    You can paste a wallet address or an ENS name
                  </AlertDialogDescription>

                  <FormMessage />

                  <Button
                    className={`w-full p-6 text-3xl disabled:bg-gold bg-dark ${poppins700.className}`}
                    type="submit"
                  >
                    Continue
                  </Button>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
};

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

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className={cn(
          `h-screen w-full bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:max-w-fit lg:rounded-3xl lg:p-12`,
        )}
      >
        <AlertDialogCancel asChild>
          <Image
            className="absolute ml-4 mt-12 h-[48px] w-[48px] cursor-pointer lg:ml-2 lg:mt-2"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
            onClick={() => {
              signOut().then(() => router.refresh());
            }}
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
                      className={`text-center text-[36px] leading-[48px] ${manjari.className}`}
                    >
                      Add your voting wallet address
                    </AlertDialogTitle>
                    <AlertDialogDescription
                      className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className}`}
                    >
                      so you can get email notifications showing if you’ve
                      already voted or not
                    </AlertDialogDescription>
                  </div>

                  <FormControl>
                    <Input
                      className={cn(
                        "h-[60px] border-gold bg-luna text-[18px] lowercase leading-[24px] focus:border-0 focus:bg-white",
                      )}
                      placeholder="0x... or proposalsapp.eth"
                      {...field}
                    />
                  </FormControl>

                  <AlertDialogDescription
                    className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className}`}
                  >
                    You can paste a wallet address or an ENS name
                  </AlertDialogDescription>

                  <FormMessage />

                  <Button
                    className={`h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold ${poppins700.className}`}
                    type="submit"
                  >
                    Success!
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

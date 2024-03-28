"use client";

import { Button } from "@/shadcn/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shadcn/ui/dialog";
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
import { addVoter } from "@/app/actions";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

const poppins300 = Poppins({
  weight: "300",
  subsets: ["latin"],
});

const poppins400 = Poppins({
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

export const OnboardingSubscriptionModal = ({ open }: { open: boolean }) => {
  const voterForm = useForm<z.infer<typeof voterFormSchema>>({
    resolver: zodResolver(voterFormSchema),
    defaultValues: {
      address: "",
    },
  });

  return (
    <Dialog open={open}>
      <DialogContent className="translate-y-[-90%] lg:translate-y-[-50%] bg-luna min-w-lg p-16 rounded-xl">
        <Form {...voterForm}>
          <form action={addVoter}>
            <FormField
              control={voterForm.control}
              name="address"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-4">
                  <div className="flex flex-col justify-center">
                    <DialogTitle
                      className={`text-center text-4xl leading-[72px] ${manjari.className}`}
                    >
                      Subscribe to your favorite DAOs
                    </DialogTitle>
                    <DialogDescription
                      className={`text-center leading-8 text-dark ${poppins300.className}`}
                    >
                      you can select all of them, or just one
                    </DialogDescription>
                  </div>

                  <FormControl></FormControl>

                  <div className="pt-8">
                    <Button
                      className={`w-full text-3xl disabled:bg-gold bg-dark ${poppins700.className}`}
                      type="submit"
                    >
                      Continue
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

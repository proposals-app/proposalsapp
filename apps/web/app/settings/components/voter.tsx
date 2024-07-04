"use client";

import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/shadcn/ui/form";
import { Input } from "@/shadcn/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

export const VoterSettings = ({
  currentVoterAddress,
  setVoterAddress,
  setVoterAddressValid,
}: {
  currentVoterAddress: string;
  setVoterAddress: (address: string) => void;
  setVoterAddressValid: (isValid: boolean) => void;
}) => {
  const voterForm = useForm<z.infer<typeof VoterFormSchema>>({
    resolver: zodResolver(VoterFormSchema),
    defaultValues: {
      address: currentVoterAddress,
    },
  });

  const handleVoterAddressChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    voterForm.setValue("address", e.target.value);
    setVoterAddress(e.target.value);
    const isValid = await voterForm.trigger("address");
    setVoterAddressValid(isValid);
  };

  return (
    <Form {...voterForm}>
      <form className="flex flex-col gap-4">
        <p className="text-[24px] leading-[36px]">your voting wallet address</p>
        <FormField
          control={voterForm.control}
          name="address"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-4">
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
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};

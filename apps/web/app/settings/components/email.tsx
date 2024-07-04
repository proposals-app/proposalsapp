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

const EmailFormSchema = z.object({
  email: z.string().email({
    message: "Email is not valid!",
  }),
});

export const EmailSettings = ({
  currentEmail,
  setEmail,
  setEmailValid,
}: {
  currentEmail: string;
  setEmail: (email: string) => void;
  setEmailValid: (isValid: boolean) => void;
}) => {
  const emailForm = useForm<z.infer<typeof EmailFormSchema>>({
    resolver: zodResolver(EmailFormSchema),
    defaultValues: {
      email: currentEmail,
    },
  });

  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    emailForm.setValue("email", e.target.value);
    setEmail(e.target.value);
    const isValid = await emailForm.trigger("email");
    setEmailValid(isValid);
  };

  return (
    <Form {...emailForm}>
      <form className="flex flex-col gap-4">
        <p className="text-[24px] leading-[36px]">your email</p>
        <FormField
          control={emailForm.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-4">
              <FormControl>
                <Input
                  className={cn(
                    "h-[60px] border-gold bg-luna text-[18px] lowercase leading-[24px] focus:border-0 focus:bg-white",
                  )}
                  placeholder="delegatoooor@defi.com"
                  {...field}
                  value={field.value}
                  onChange={handleEmailChange}
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

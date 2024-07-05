"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shadcn/ui/button";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/shadcn/ui/input-otp";
import { Manjari, Poppins } from "next/font/google";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/shadcn/ui/alert-dialog";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

const poppins300 = Poppins({
  weight: "300",
  subsets: ["latin"],
});

const poppins400 = Poppins({
  weight: "400",
  subsets: ["latin"],
});

const poppins700 = Poppins({
  weight: "700",
  subsets: ["latin"],
});

const OtpFormSchema = z.object({
  otp: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export const VerificationModal = ({ email }: { email: string }) => {
  const router = useRouter();

  const otpForm = useForm<z.infer<typeof OtpFormSchema>>({
    resolver: zodResolver(OtpFormSchema),
    defaultValues: {
      otp: "",
    },
  });

  const verifyOtp = async (data: z.infer<typeof OtpFormSchema>) => {
    try {
      await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp: data.otp }),
      }).then(() => router.refresh());
    } catch (error) {
      console.error("Error verifying OTP:", error);
    }
  };

  return (
    <AlertDialog defaultOpen={true}>
      <AlertDialogContent
        className={cn(
          `h-screen w-full bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:rounded-3xl lg:p-12`,
        )}
      >
        <AlertDialogCancel asChild>
          <Image
            className="absolute ml-4 mt-12 h-[48px] w-[48px] cursor-pointer lg:ml-2 lg:mt-2"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
            style={{
              maxWidth: "100%",
              height: "auto"
            }} />
        </AlertDialogCancel>

        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(verifyOtp)}>
            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-4">
                  <div className="flex flex-col justify-center">
                    <AlertDialogTitle
                      className={`text-center text-[36px] font-bold leading-[48px] ${manjari.className}`}
                    >
                      Verify your email address
                    </AlertDialogTitle>

                    <AlertDialogDescription
                      className={`text-center text-[18px] font-light leading-[26px] ${poppins300.className}`}
                    >
                      Please enter the code we just sent to {email}
                    </AlertDialogDescription>
                  </div>

                  <div className="flex w-full items-center justify-center">
                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup>
                          <InputOTPSlot
                            index={0}
                            className={`h-[60px] w-[60px] border-gold bg-white text-2xl ring-gold ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={1}
                            className={`h-[60px] w-[60px] border-gold bg-white text-2xl ring-gold ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={2}
                            className={`h-[60px] w-[60px] border-gold bg-white text-2xl ring-gold ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={3}
                            className={`h-[60px] w-[60px] border-gold bg-white text-2xl ring-gold ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={4}
                            className={`h-[60px] w-[60px] border-gold bg-white text-2xl ring-gold ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={5}
                            className={`h-[60px] w-[60px] border-gold bg-white text-2xl ring-gold ${poppins400.className}`}
                          />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                  </div>

                  <AlertDialogDescription
                    className={`text-center text-[18px] font-light leading-[26px] ${poppins300.className}`}
                  >
                    It should be a 6 digit PIN
                  </AlertDialogDescription>

                  <FormMessage />

                  <div className="pt-8">
                    <Button
                      className={`h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold ${poppins700.className}`}
                      type="submit"
                      disabled={field.value.length !== 6}
                    >
                      Go!
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
};

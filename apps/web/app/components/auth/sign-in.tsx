"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shadcn/ui/button";
import { Input } from "@/shadcn/ui/input";
import { Checkbox } from "@/shadcn/ui/checkbox";
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
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/shadcn/ui/alert-dialog";
import { AlertDialogCancel } from "@/shadcn/ui/alert-dialog";

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

const EmailFormSchema = z.object({
  email: z.string().email({
    message: "Email is not valid!",
  }),
});

const OtpFormSchema = z.object({
  otp: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export const SignInButton = () => {
  enum Page {
    EMAIL,
    CODE,
  }

  const [termsAgreed, setTermsAgreed] = useState(false);
  const router = useRouter();
  const [page, setPage] = useState(Page.EMAIL);

  const emailForm = useForm<z.infer<typeof EmailFormSchema>>({
    resolver: zodResolver(EmailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const otpForm = useForm<z.infer<typeof OtpFormSchema>>({
    resolver: zodResolver(OtpFormSchema),
    defaultValues: {
      otp: "",
    },
  });

  const signIn = async (data: z.infer<typeof EmailFormSchema>) => {
    try {
      setPage(Page.CODE);
      await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const verify = async (data: z.infer<typeof OtpFormSchema>) => {
    try {
      await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then(() => router.refresh());
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className={`${manjari.className} block min-h-14 rounded-lg hover:bg-rainbow hover:text-dark hover:border-0 hover:px-[18px] text-4xl bg-luna border-2 border-gold text-gold`}
        >
          <p className="text-4xl leading-[3rem]">sign in</p>
        </Button>
      </AlertDialogTrigger>
      {page == Page.EMAIL && (
        <AlertDialogContent
          className={cn(
            `bg-luna w-full lg:max-w-[40%] p-16 rounded-3xl sm:rounded-3xl`,
          )}
        >
          <AlertDialogCancel asChild>
            <Image
              className="absolute m-2 w-8 h-8 sm:w-12 sm:h-12"
              src="/assets/icons/web/new/close-button.svg"
              width={48}
              height={48}
              alt="close button"
            />
          </AlertDialogCancel>

          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(signIn)}>
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-4">
                    <div className="flex flex-col justify-center">
                      <AlertDialogTitle
                        className={`py-4 text-center text-4xl ${manjari.className}`}
                      >
                        Subscribe to get email notifications
                      </AlertDialogTitle>
                      <AlertDialogDescription
                        className={`py-4 text-center text-2xl leading-8 ${poppins300.className}`}
                      >
                        and you will get an email every single day there are
                        proposals for you to vote on
                      </AlertDialogDescription>
                    </div>

                    <FormControl>
                      <Input
                        className="bg-luna border-gold lowercase"
                        placeholder="delegatoooor@defi.com"
                        {...field}
                      />
                    </FormControl>

                    <div className="items-top flex space-x-2">
                      <Checkbox
                        id="terms1"
                        onCheckedChange={(e) =>
                          setTermsAgreed(typeof e === "boolean" ? e : false)
                        }
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="terms1"
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          I accept the <Link href="/ts">Terms of Service</Link>{" "}
                          and <Link href="/pp">Privacy Policy</Link>.
                        </label>
                      </div>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-8">
                <Button
                  className={`w-full text-3xl disabled:bg-gold bg-dark ${poppins700.className}`}
                  type="submit"
                  disabled={!termsAgreed}
                >
                  Go!
                </Button>
              </div>
            </form>
          </Form>
        </AlertDialogContent>
      )}
      {page == Page.CODE && (
        <AlertDialogContent
          className={cn(
            `bg-luna w-full lg:max-w-[40%] p-16 rounded-3xl sm:rounded-3xl`,
          )}
        >
          <AlertDialogCancel asChild>
            <Image
              className="absolute m-2 w-8 h-8 sm:w-12 sm:h-12"
              src="/assets/icons/web/new/back-button.svg"
              width={48}
              height={48}
              alt="back button"
            />
          </AlertDialogCancel>

          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(verify)}>
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-4">
                    <div className="flex flex-col justify-center">
                      <AlertDialogTitle
                        className={`py-4 text-center text-4xl ${manjari.className}`}
                      >
                        Verify your email address
                      </AlertDialogTitle>
                      <AlertDialogDescription
                        className={`text-center text-2xl leading-8 ${poppins300.className}`}
                      >
                        please enter the code we just sent to{" "}
                        {emailForm.getValues().email}
                      </AlertDialogDescription>
                    </div>

                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup className="w-full flex flex-row items-center justify-center">
                          <InputOTPSlot
                            index={0}
                            className={`border-gold bg-white ring-gold text-2xl ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={1}
                            className={`border-gold bg-white ring-gold text-2xl ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={2}
                            className={`border-gold bg-white ring-gold text-2xl ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={3}
                            className={`border-gold bg-white ring-gold text-2xl ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={4}
                            className={`border-gold bg-white ring-gold text-2xl ${poppins400.className}`}
                          />
                          <InputOTPSlot
                            index={5}
                            className={`border-gold bg-white ring-gold text-2xl ${poppins400.className}`}
                          />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>

                    <AlertDialogDescription
                      className={`text-center leading-8 text-dark ${poppins300.className}`}
                    >
                      it should be a 6 digit PIN
                    </AlertDialogDescription>

                    <FormMessage />

                    <div className="pt-8">
                      <Button
                        className={`w-full text-3xl disabled:bg-gold bg-dark ${poppins700.className}`}
                        type="submit"
                        disabled={field.value.length != 6}
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
      )}
    </AlertDialog>
  );
};

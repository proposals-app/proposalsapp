"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/shadcn/ui/button";
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
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/shadcn/ui/alert-dialog";
import { AlertDialogCancel } from "@/shadcn/ui/alert-dialog";
import { cn } from "@/shadcn/lib/utils";

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

export const SubscribeButton = () => {
  enum Page {
    EMAIL,
    CODE,
  }

  const [termsAgreed, setTermsAgreed] = useState(false);
  const router = useRouter();
  const [page, setPage] = useState(Page.EMAIL);
  const [email, setEmail] = useState("");

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
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setEmail(data.email);
        setPage(Page.CODE);
      } else {
        // Handle error
        console.error("Error sending verification code");
      }
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const verify = async (data: z.infer<typeof OtpFormSchema>) => {
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp: data.otp }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        // Handle error
        console.error("Error verifying code");
      }
    } catch (error) {
      console.error("Error verifying:", error);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className={`${manjari.className} block h-[42px] w-[160px] rounded-lg border-2 border-gold bg-luna text-center text-gold lg:h-[56px]`}
        >
          <p className="text-[24px] leading-[32px] lg:leading-[46px]">
            subscribe
          </p>
        </Button>
      </AlertDialogTrigger>
      {page == Page.EMAIL && (
        <AlertDialogContent
          className={cn(
            `h-screen w-full bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:rounded-3xl lg:p-12`,
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
              className="absolute ml-4 mt-12 h-[48px] w-[48px] cursor-pointer lg:ml-2 lg:mt-2"
              src="/assets/icons/web/new/close-button.svg"
              alt="close button"
              width={48}
              height={48}
              style={{
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </AlertDialogCancel>

          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(signIn)}>
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-4">
                    <div className="flex flex-col justify-center gap-4">
                      <AlertDialogTitle
                        className={`text-center text-[36px] font-bold leading-[48px] ${manjari.className}`}
                      >
                        Subscribe to get email notifications
                      </AlertDialogTitle>
                      <AlertDialogDescription
                        className={`text-center text-[18px] font-light leading-[26px] ${poppins300.className}`}
                      >
                        and you will get an email every single day there are
                        proposals for you to vote on
                      </AlertDialogDescription>
                    </div>

                    <FormControl>
                      <Input
                        className={cn(
                          "h-[60px] border-gold bg-luna text-[18px] lowercase leading-[24px] focus:border-0 focus:bg-white md:text-base",
                        )}
                        placeholder="delegatoooor@defi.com"
                        {...field}
                      />
                    </FormControl>

                    <div className="items-top flex space-x-2">
                      <Checkbox
                        id="terms1"
                        className="h-[32px] w-[32px]"
                        onCheckedChange={(e) =>
                          setTermsAgreed(typeof e === "boolean" ? e : false)
                        }
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="terms1"
                          className={`text-[18px] font-light leading-[26px] ${poppins300.className}`}
                        >
                          I accept the{" "}
                          <Link
                            href="https://proposalsapp.notion.site/Terms-of-Service-f49f7c78c4e343f39a78cfaeba5dcba6?pvs=4"
                            target="_blank"
                            className="underline"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="https://proposalsapp.notion.site/Privacy-Policy-412871ef78904cb8848d91dd6d743e97?pvs=4"
                            target="_blank"
                            className="underline"
                          >
                            Privacy Policy
                          </Link>
                          .
                        </label>
                      </div>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-8">
                <Button
                  className={`h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold ${poppins700.className}`}
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
            `h-screen w-full bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:rounded-3xl lg:p-12`,
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
              className="absolute ml-4 mt-12 h-[48px] w-[48px] cursor-pointer lg:ml-2 lg:mt-2"
              src="/assets/icons/web/new/back-button.svg"
              alt="back button"
              width={48}
              height={48}
              style={{
                maxWidth: "100%",
                height: "auto",
              }}
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
                        className={`text-center text-[36px] font-bold leading-[48px] ${manjari.className}`}
                      >
                        Verify your email address
                      </AlertDialogTitle>

                      <AlertDialogDescription
                        className={`text-center text-[18px] font-light leading-[26px] ${poppins300.className}`}
                      >
                        please enter the code we just sent to{" "}
                        {emailForm.getValues().email}
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
                      it should be a 6 digit PIN
                    </AlertDialogDescription>

                    <FormMessage />

                    <div className="pt-8">
                      <Button
                        className={`h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold ${poppins700.className}`}
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

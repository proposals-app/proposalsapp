"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shadcn/ui/dialog";
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
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            className={`block min-h-14 min-w-48 text-4xl ${manjari.className} py-2 text-dark`}
            style={{
              background:
                "linear-gradient(0.25turn, #F87171, #FACC15, #4ADE80)",
            }}
          >
            <p className="text-4xl leading-[3.25rem]">sign in</p>
          </Button>
        </DialogTrigger>
        {page == Page.EMAIL && (
          <DialogContent className="translate-y-[-90%] lg:translate-y-[-50%] bg-luna min-w-fit p-16 rounded-xl">
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(signIn)}>
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-4">
                      <div className="flex flex-col justify-center">
                        <DialogTitle
                          className={`text-center text-4xl leading-[72px] ${manjari.className}`}
                        >
                          Sign in to get notification emails
                        </DialogTitle>
                        <DialogDescription
                          className={`text-center text-2xl leading-8 ${poppins300.className}`}
                        >
                          and you will get an email every single day there are
                          proposals for you to vote on
                        </DialogDescription>
                      </div>

                      <FormControl>
                        <Input
                          className="bg-luna border-gold"
                          placeholder="delegatoooor@defi.com"
                          {...field}
                        />
                      </FormControl>

                      <div className="items-top flex space-x-2">
                        <Checkbox
                          id="terms1"
                          onCheckedChange={() => setTermsAgreed(!termsAgreed)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="terms1"
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            I accept the{" "}
                            <Link href="/ts">Terms of Service</Link> and{" "}
                            <Link href="/pp">Privacy Policy</Link>.
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
          </DialogContent>
        )}
        {page == Page.CODE && (
          <DialogContent className="translate-y-[-90%] lg:translate-y-[-50%] bg-luna min-w-fit p-16 rounded-xl">
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(verify)}>
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-4">
                      <div className="flex flex-col justify-center">
                        <DialogTitle
                          className={`text-center text-4xl leading-[72px] ${manjari.className}`}
                        >
                          Verify your email
                        </DialogTitle>
                        <DialogDescription
                          className={`text-center text-2xl leading-8 ${poppins300.className}`}
                        >
                          please enter the code we just sent to the email
                          address you’ve provided
                        </DialogDescription>
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

                      <DialogDescription
                        className={`text-center leading-8 text-dark ${poppins300.className}`}
                      >
                        it should be a 6 digit PIN
                      </DialogDescription>

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
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};

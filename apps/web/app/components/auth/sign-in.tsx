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

export const SignInButton = () => {
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
    console.log(data);
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
          <Button>Sign In</Button>
        </DialogTrigger>
        {page == Page.EMAIL && (
          <DialogContent>
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(signIn)}>
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-4">
                      <div>
                        <DialogTitle>Welcome to proposals.app</DialogTitle>
                        <DialogDescription>
                          Sign in with your email to get started
                        </DialogDescription>
                      </div>

                      <FormControl>
                        <Input placeholder="delegatoooor@defi.com" {...field} />
                      </FormControl>

                      <div className="items-top flex space-x-2">
                        <Checkbox
                          id="terms1"
                          onCheckedChange={() => setTermsAgreed(!termsAgreed)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="terms1"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Accept terms and conditions
                          </label>
                          <p className="text-sm text-muted-foreground">
                            You agree to our Terms of Service and Privacy
                            Policy.
                          </p>
                        </div>
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-8">
                  <Button
                    className="w-full"
                    type="submit"
                    disabled={!termsAgreed}
                  >
                    Get Code
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        )}
        {page == Page.CODE && (
          <DialogContent>
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(verify)}>
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-4">
                      <div>
                        <DialogTitle>Verify your email</DialogTitle>
                        <DialogDescription>
                          Please enter the code we sent you.
                        </DialogDescription>
                      </div>

                      <FormControl>
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup className="w-full justify-center">
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-8">
                  <Button className="w-full" type="submit">
                    Verify
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};

'use client';

import { authClient } from '@/lib/auth-client';
import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [signInError, setSignInError] = useState('');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [sentEmail, setSentEmail] = useState(false); // Track if email is sent, for UI state

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setSentEmail(false); // Reset sentEmail state when resending OTP
    startTransition(async () => {
      const { error: sendOtpError } =
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
        });

      if (sendOtpError) {
        setSignInError('Failed to send OTP. Please check your email address.');
      } else {
        setStage('otp');
        setSentEmail(true); // Indicate email sent for UI update
        // Automatically focus on the first OTP input after sending OTP
        if (otpInputs.current[0]) {
          otpInputs.current[0]?.focus();
        }
      }
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    startTransition(async () => {
      const otpCode = otp.join('');
      const { error: signInError } = await authClient.signIn.emailOtp({
        email,
        otp: otpCode,
      });

      if (signInError) {
        setSignInError('Invalid OTP or email. Please try again.');
      } else {
        router.push('/profile');
        router.refresh();
      }
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    const newOtp = [...otp];

    if (value.length > 1) {
      // Handle paste or autocomplete
      const pastedValues = value.split('');
      pastedValues.forEach((char, i) => {
        if (index + i < 6 && /^[0-9]$/.test(char)) {
          // Only accept digits
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);

      // Focus on the next empty input or last input if all filled
      const nextFocusIndex = index + pastedValues.length;
      if (nextFocusIndex < 6 && otpInputs.current[nextFocusIndex]) {
        otpInputs.current[nextFocusIndex]?.focus();
      } else if (nextFocusIndex >= 6) {
        otpInputs.current[5]?.focus(); // Focus on the last input if filled or exceeded
      }
    } else if (/^[0-9]$/.test(value) || value === '') {
      // Only accept digits and empty string for single input
      // Handle single digit input
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < 5 && otpInputs.current[index + 1]) {
        otpInputs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (
      e.key === 'Backspace' &&
      !otp[index] &&
      index > 0 &&
      otpInputs.current[index - 1]
    ) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleDifferentEmail = () => {
    setSentEmail(false);
    setStage('email');
    setSignInError('');
    setOtp(['', '', '', '', '', '']);
  };

  return (
    <div className='flex w-full flex-col items-center p-8'>
      <div className='w-full max-w-sm'>
        <div
          className='text-card-foreground border-neutral-350 dark:border-neutral-650 border
            bg-neutral-50 dark:bg-neutral-950'
        >
          <div className='flex flex-col space-y-1.5 p-6'>
            <h3 className='text-2xl font-semibold tracking-tight'>
              Welcome Back
            </h3>
            <p className='text-muted-foreground text-sm'>
              Sign in to your account using your email
            </p>
          </div>
          <div className='p-6'>
            {signInError && (
              <div className='border p-4'>
                <p className='text-sm'>{signInError}</p>
              </div>
            )}

            {!sentEmail && stage === 'email' && (
              <form onSubmit={handleSendOtp} className='space-y-4'>
                <div className='space-y-2'>
                  <label
                    htmlFor='email'
                    className='text-sm leading-none font-medium peer-disabled:cursor-not-allowed
                      peer-disabled:opacity-70'
                  >
                    Email
                  </label>
                  <div className='relative'>
                    <input
                      id='email'
                      type='email'
                      placeholder='your.email@example.com'
                      className={`focus:ring-brand-accent focus:ring-opacity-50 w-full border border-neutral-300
                      bg-white px-3 py-2 pl-10 text-sm text-neutral-900 focus:ring-2
                      dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                      ${signInError ? 'border-red-500 dark:border-red-500' : ''}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Mail
                      className='absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-500
                        dark:text-neutral-400'
                    />
                  </div>
                </div>
                <button
                  type='submit'
                  className={`ring-offset-background focus-visible:ring-ring text-primary-foreground
                  inline-flex h-10 w-full items-center justify-center bg-neutral-200 px-4 py-2
                  text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2
                  focus-visible:ring-offset-2 focus-visible:outline-none
                  disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-700
                  ${isPending || !email.trim() ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={isPending || !email.trim()}
                >
                  {isPending ? 'Sending...' : 'Sign in with Email'}
                </button>
              </form>
            )}

            {sentEmail && stage === 'otp' && (
              <div className='space-y-4 py-4'>
                <div className='flex flex-col items-center justify-center space-y-2'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='text-primary mx-auto h-12 w-12'
                  >
                    <path d='M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z' />
                    <path d='m9 12 2 2 4-4' />
                  </svg>
                  <p className='text-muted-foreground text-center text-sm'>
                    We&apos;ve sent a verification code to {email}. Please check
                    your inbox and enter the code below to sign in.
                  </p>
                </div>
                <form onSubmit={handleSignIn} className='space-y-4'>
                  <div className='space-y-2'>
                    <label
                      htmlFor='otp-0'
                      className='text-sm leading-none font-medium peer-disabled:cursor-not-allowed
                        peer-disabled:opacity-70'
                    >
                      Verification code
                    </label>
                    <div className='flex justify-between gap-2'>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type='text'
                          inputMode='numeric'
                          pattern='[0-9]*'
                          maxLength={6} // Increased maxLength to allow pasting of full OTP
                          ref={(el) => {
                            otpInputs.current[index] = el;
                          }}
                          className={`focus:ring-brand-accent focus:ring-opacity-50 h-12 w-12 border
                          border-neutral-300 bg-white text-center text-lg text-neutral-900 focus:ring-2
                          dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                          ${signInError ? 'border-red-500 dark:border-red-500' : ''}`}
                          value={digit}
                          onChange={(e) =>
                            handleOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          autoFocus={index === 0 && stage === 'otp'}
                          autoComplete='one-time-code' // Enable OTP autocomplete
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type='submit'
                    className={`ring-offset-background focus-visible:ring-ring text-primary-foreground
                    inline-flex h-10 w-full items-center justify-center bg-neutral-200 px-4 py-2
                    text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2
                    focus-visible:ring-offset-2 focus-visible:outline-none
                    disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-700
                    ${isPending || otp.some((d) => !d) ? 'cursor-not-allowed opacity-50' : ''}`}
                    disabled={isPending || otp.some((d) => !d)}
                  >
                    {isPending ? 'Verifying...' : 'Verify Code'}
                  </button>

                  <div className='text-muted-foreground text-center text-sm'>
                    <button
                      type='button'
                      onClick={handleDifferentEmail}
                      className='text-brand-accent dark:text-brand-accent-bright hover:underline'
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
          <div className='border-t px-6 py-4 text-center'>
            <p className='text-muted-foreground text-xs'>
              By continuing, you agree to our{' '}
              <a href='#' className='underline underline-offset-2'>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href='#' className='underline underline-offset-2'>
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [sentEmail, setSentEmail] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setSentEmail(false);
    startTransition(async () => {
      const { error: sendOtpError } =
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
        });

      if (sendOtpError) {
        setSignInError('Failed to send OTP.');
      } else {
        setStage('otp');
        setSentEmail(true);
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
      const pastedValues = value.split('');
      pastedValues.forEach((char, i) => {
        if (index + i < 6 && /^[0-9]$/.test(char)) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);

      const nextFocusIndex = index + pastedValues.length;
      if (nextFocusIndex < 6 && otpInputs.current[nextFocusIndex]) {
        otpInputs.current[nextFocusIndex]?.focus();
      } else if (nextFocusIndex >= 6) {
        otpInputs.current[5]?.focus();
      }
    } else if (/^[0-9]$/.test(value) || value === '') {
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
    <div className='flex w-full flex-col items-center pt-24'>
      <div className='w-full max-w-sm'>
        <div className='border-neutral-350 dark:border-neutral-650 border bg-neutral-50 dark:bg-neutral-950'>
          <div className='flex flex-col space-y-1.5 p-4 sm:p-6'>
            <h3 className='text-xl font-semibold tracking-tight sm:text-2xl'>
              Welcome Back
            </h3>
            <p className='text-xs text-neutral-500 sm:text-sm dark:text-neutral-400'>
              Sign in to your account using your email
            </p>
          </div>
          <div className='p-4 sm:p-6'>
            {signInError && (
              <div className='mb-4 border border-red-200 bg-red-50 p-3 text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400'>
                <p className='text-xs sm:text-sm'>{signInError}</p>
              </div>
            )}

            {!sentEmail && stage === 'email' && (
              <form onSubmit={handleSendOtp} className='space-y-4'>
                <div className='space-y-2'>
                  <div className='relative'>
                    <input
                      id='email'
                      type='email'
                      placeholder='your.email@example.com'
                      className={`w-full border bg-white px-3 py-2 pl-10 text-xs text-neutral-900 outline-none sm:py-2.5 sm:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${signInError ? 'border-red-500 dark:border-red-500' : 'border-neutral-300'}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Mail className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500 sm:h-5 sm:w-5 dark:text-neutral-400' />
                  </div>
                </div>
                <button
                  type='submit'
                  className={`inline-flex h-9 w-full items-center justify-center bg-neutral-200 px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:text-sm dark:bg-neutral-700 ${isPending || !email.trim() ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={isPending || !email.trim()}
                >
                  {isPending ? 'Sending...' : 'Sign in with Email'}
                </button>
              </form>
            )}

            {sentEmail && stage === 'otp' && (
              <div className='space-y-4 py-2 sm:py-4'>
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
                    className='mx-auto h-10 w-10 text-green-500 sm:h-12 sm:w-12'
                  >
                    <path d='M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z' />
                    <path d='m9 12 2 2 4-4' />
                  </svg>
                  <p className='text-center text-xs text-neutral-500 sm:text-sm dark:text-neutral-400'>
                    We&apos;ve sent a verification code to {email}. Please check
                    your inbox and enter the code below to sign in.
                  </p>
                </div>
                <form onSubmit={handleSignIn} className='space-y-4'>
                  <div className='space-y-2'>
                    <div className='flex justify-center gap-1 sm:gap-2'>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type='text'
                          inputMode='numeric'
                          pattern='[0-9]*'
                          maxLength={6}
                          ref={(el) => {
                            otpInputs.current[index] = el;
                          }}
                          className={`h-9 w-9 border bg-white text-center text-base text-neutral-900 outline-none sm:h-12 sm:w-12 sm:text-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${signInError ? 'border-red-500 dark:border-red-500' : 'border-neutral-300'}`}
                          value={digit}
                          onChange={(e) =>
                            handleOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          autoFocus={index === 0 && stage === 'otp'}
                          autoComplete='one-time-code'
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type='submit'
                    className={`inline-flex h-9 w-full items-center justify-center bg-neutral-200 px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:text-sm dark:bg-neutral-700 ${isPending || otp.some((d) => !d) ? 'cursor-not-allowed opacity-50' : ''}`}
                    disabled={isPending || otp.some((d) => !d)}
                  >
                    {isPending ? 'Verifying...' : 'Verify Code'}
                  </button>

                  <div className='text-center text-xs text-neutral-500 sm:text-sm dark:text-neutral-400'>
                    <button
                      type='button'
                      onClick={handleDifferentEmail}
                      className='text-blue-600 hover:underline dark:text-blue-400'
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
          <div className='border-t border-neutral-200 px-4 py-3 text-center sm:px-6 sm:py-4 dark:border-neutral-700'>
            <p className='text-xs text-neutral-500 dark:text-neutral-400'>
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

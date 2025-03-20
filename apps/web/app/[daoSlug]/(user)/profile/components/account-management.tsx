'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Session } from '@/lib/auth';
import { Mail, Trash2, RefreshCw } from 'lucide-react';

interface AccountManagementProps {
  session: Session;
}

export const AccountManagement = ({ session }: AccountManagementProps) => {
  const [newEmail, setNewEmail] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === session.user.email) {
      setError('Please enter a different email address');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsChangingEmail(true);

    try {
      await authClient.changeEmail({
        newEmail: newEmail,
        callbackURL: '/profile',
      });

      setSuccess(
        'Verification email sent to your current email address. Please check your inbox to confirm this change.'
      );
      setNewEmail('');
    } catch (err) {
      setError('Failed to request email change. Please try again.');
      console.error('Error changing email:', err);
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError(null);
    setSuccess(null);
    setIsDeleting(true);

    try {
      await authClient.deleteUser({
        callbackURL: '/', // Redirect to homepage after deletion is complete
      });

      // This might not execute if the user is immediately redirected
      setSuccess(
        'Account deletion request has been sent. Please check your email to confirm.'
      );
    } catch (err) {
      setError('Failed to request account deletion. Please try again.');
      console.error('Error deleting account:', err);
      setShowConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className='container w-full py-10'>
      <h1 className='mb-6 text-3xl font-bold'>Account Management</h1>

      {error && (
        <div className='mb-6 bg-red-50 p-4 dark:bg-red-900/20'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-red-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-red-800 dark:text-red-200'>
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className='mb-6 bg-green-50 p-4 dark:bg-green-900/20'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-green-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-green-800 dark:text-green-200'>
                {success}
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className='border-card-foreground border-neutral-350 dark:border-neutral-650 border
          bg-neutral-50 dark:bg-neutral-950'
      >
        <div className='px-6 pt-6 pb-2'>
          <h2 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
            Email Address
          </h2>
          <p className='text-muted-foreground text-sm text-neutral-500 dark:text-neutral-400'>
            Change your email address. You&apos;ll need to verify the new email.
          </p>
        </div>
        <div className='space-y-6 px-6 py-4'>
          <div className='flex items-start space-x-3'>
            <Mail className='text-muted-foreground mt-0.5 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
            <div className='w-full'>
              <label
                htmlFor='current-email'
                className='text-base font-medium text-neutral-900 dark:text-neutral-100'
              >
                Current Email
              </label>
              <p className='text-muted-foreground mb-4 text-sm text-neutral-500 dark:text-neutral-400'>
                {session.user.email}
              </p>

              <label
                htmlFor='new-email'
                className='text-base font-medium text-neutral-900 dark:text-neutral-100'
              >
                New Email
              </label>
              <div className='mt-1 flex max-w-md'>
                <input
                  type='email'
                  id='new-email'
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder='Enter your new email address'
                  className='focus:ring-brand-accent focus:ring-opacity-50 w-full border border-neutral-300
                    bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 dark:border-neutral-700
                    dark:bg-neutral-900 dark:text-neutral-100'
                />
                <button
                  onClick={handleChangeEmail}
                  disabled={isChangingEmail || !newEmail.trim()}
                  className='focus-visible:ring-ring ml-2 inline-flex items-center justify-center
                    bg-neutral-200 px-4 py-2 text-sm font-medium whitespace-nowrap text-neutral-900
                    transition-colors focus-visible:ring-2 focus-visible:ring-offset-2
                    focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50
                    dark:bg-neutral-700 dark:text-neutral-100'
                >
                  {isChangingEmail && (
                    <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  Update Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className='border-card-foreground border-neutral-350 dark:border-neutral-650 mt-8 border
          bg-neutral-50 dark:bg-neutral-950'
      >
        <div className='px-6 pt-6 pb-2'>
          <h2 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
            Delete Account
          </h2>
          <p className='text-muted-foreground text-sm text-neutral-500 dark:text-neutral-400'>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
        </div>
        <div className='space-y-6 px-6 py-4'>
          <div className='flex items-start space-x-3'>
            <Trash2 className='mt-0.5 h-5 w-5 text-red-500' />
            <div>
              <p className='text-muted-foreground mb-4 text-sm text-neutral-500 dark:text-neutral-400'>
                Once you delete your account, there is no going back. All of
                your data will be permanently removed.
              </p>

              {!showConfirmDelete ? (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className='focus-visible:ring-ring inline-flex items-center justify-center bg-red-100 px-4
                    py-2 text-sm font-medium whitespace-nowrap text-red-700 transition-colors
                    hover:bg-red-200 focus-visible:ring-2 focus-visible:ring-offset-2
                    focus-visible:outline-none dark:bg-red-900/20 dark:text-red-300
                    dark:hover:bg-red-900/30'
                >
                  Delete Account
                </button>
              ) : (
                <div className='space-y-4 bg-red-50 p-4 dark:bg-red-900/10'>
                  <p className='text-sm font-medium text-red-800 dark:text-red-200'>
                    Are you sure you want to delete your account? This action
                    cannot be undone.
                  </p>
                  <div className='flex space-x-3'>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className='focus-visible:ring-ring inline-flex items-center justify-center bg-red-600 px-4
                        py-2 text-sm font-medium whitespace-nowrap text-white transition-colors
                        hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-offset-2
                        focus-visible:outline-none disabled:opacity-50 dark:bg-red-700
                        dark:hover:bg-red-600'
                    >
                      {isDeleting && (
                        <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                      )}
                      Yes, Delete My Account
                    </button>
                    <button
                      onClick={() => setShowConfirmDelete(false)}
                      disabled={isDeleting}
                      className='focus-visible:ring-ring inline-flex items-center justify-center bg-neutral-100
                        px-4 py-2 text-sm font-medium whitespace-nowrap text-neutral-900
                        transition-colors hover:bg-neutral-200 focus-visible:ring-2
                        focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50
                        dark:bg-neutral-800 dark:text-neutral-100'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import { useState } from 'react';
import { Bell, Mail, RefreshCw } from 'lucide-react';
import { Session } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { saveSettings, SettingsData } from './../actions';

interface UserSettingsProps {
  session: Session;
}

export const UserSettings = ({ session }: UserSettingsProps) => {
  const router = useRouter();
  const [newDiscussions, setNewDiscussions] = useState(
    session.user.emailSettingsNewDiscussions
  );
  const [newProposals, setNewProposals] = useState(
    session.user.emailSettingsNewProposals
  );
  const [dailyRoundup, setDailyRoundup] = useState(
    session.user.emailSettingsDailyRoundup
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const settingsData: SettingsData = {
      newDiscussions: newDiscussions,
      newProposals: newProposals,
      dailyRoundup: dailyRoundup,
      isOnboarded: true,
    };

    await saveSettings(settingsData);

    setIsSaving(false);
    setSaveSuccess(true);

    // Clear success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);

    router.refresh();
  };

  if (!session?.user) {
    return (
      <div className='w-full'>
        <p className='text-center text-neutral-600 dark:text-neutral-400'>
          Please sign in to view your profile settings.
        </p>
      </div>
    );
  }

  const Toggle = ({
    checked,
    onChange,
    id,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    id: string;
  }) => {
    return (
      <div
        className={`relative inline-flex h-6 w-11 cursor-pointer items-center transition-colors ${
          checked
            ? 'bg-brand-accent dark:bg-brand-accent-bright'
            : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
        onClick={() => onChange(!checked)}
        role='switch'
        aria-checked={checked}
        id={id}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <span
          className={`inline-block h-5 w-5 transform bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </div>
    );
  };

  return (
    <div className='w-full py-4 sm:py-6 md:py-10'>
      <div className='mb-4 flex items-center justify-between sm:mb-6'>
        <h1 className='text-2xl font-bold sm:text-3xl'>
          Notification Settings
        </h1>
      </div>

      <div className='border-neutral-350 dark:border-neutral-650 border bg-neutral-50 shadow-sm dark:bg-neutral-950'>
        <div className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
          <h2 className='text-base font-semibold text-neutral-900 sm:text-lg dark:text-neutral-100'>
            Email Notifications
          </h2>
          <p className='text-sm text-neutral-500 dark:text-neutral-400'>
            Configure how and when you receive email notifications
          </p>
        </div>
        <div className='space-y-4 px-4 py-3 sm:space-y-6 sm:px-6 sm:py-4'>
          {/* New discussions setting */}
          <div className='sm:grid sm:grid-cols-8 sm:items-center sm:gap-4'>
            <div className='flex items-start space-x-2 sm:col-span-6 sm:space-x-3'>
              <Bell className='mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500 sm:h-5 sm:w-5 dark:text-neutral-400' />
              <div>
                <label
                  htmlFor='new-discussions'
                  className='text-sm font-medium text-neutral-900 sm:text-base dark:text-neutral-100'
                >
                  New discussions
                </label>
                <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                  Receive an email when a new discussion is created
                </p>
              </div>
            </div>
            <div className='mt-2 flex justify-end sm:col-span-2 sm:mt-0'>
              <Toggle
                id='new-discussions'
                checked={newDiscussions}
                onChange={setNewDiscussions}
              />
            </div>
          </div>

          {/* New proposals setting */}
          <div className='sm:grid sm:grid-cols-8 sm:items-center sm:gap-4'>
            <div className='flex items-start space-x-2 sm:col-span-6 sm:space-x-3'>
              <Bell className='mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500 sm:h-5 sm:w-5 dark:text-neutral-400' />
              <div>
                <label
                  htmlFor='new-proposals'
                  className='text-sm font-medium text-neutral-900 sm:text-base dark:text-neutral-100'
                >
                  New proposals
                </label>
                <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                  Receive an email when a new proposal is submitted
                </p>
              </div>
            </div>
            <div className='mt-2 flex justify-end sm:col-span-2 sm:mt-0'>
              <Toggle
                id='new-proposals'
                checked={newProposals}
                onChange={setNewProposals}
              />
            </div>
          </div>

          {/* Daily roundup setting */}
          <div className='sm:grid sm:grid-cols-8 sm:items-center sm:gap-4'>
            <div className='flex items-start space-x-2 sm:col-span-6 sm:space-x-3'>
              <Mail className='mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500 sm:h-5 sm:w-5 dark:text-neutral-400' />
              <div>
                <label
                  htmlFor='daily-roundup'
                  className='text-sm font-medium text-neutral-900 sm:text-base dark:text-neutral-100'
                >
                  Daily roundup
                </label>
                <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                  Receive a daily email with a summary of new discussions and
                  proposals
                </p>
              </div>
            </div>
            <div className='mt-2 flex justify-end sm:col-span-2 sm:mt-0'>
              <Toggle
                id='daily-roundup'
                checked={dailyRoundup}
                onChange={setDailyRoundup}
              />
            </div>
          </div>
        </div>

        <div className='flex justify-end border-t border-neutral-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-neutral-700'>
          {saveSuccess && (
            <div className='mr-3 flex items-center text-green-600 dark:text-green-400'>
              <svg
                className='mr-1 h-4 w-4'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
              <span className='text-xs'>Settings saved</span>
            </div>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className='inline-flex items-center justify-center bg-neutral-200 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-neutral-900 transition-colors hover:bg-neutral-300 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none disabled:opacity-50 sm:px-4 sm:py-2 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600'
          >
            {isSaving && (
              <RefreshCw className='mr-2 h-3 w-3 animate-spin sm:h-4 sm:w-4' />
            )}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

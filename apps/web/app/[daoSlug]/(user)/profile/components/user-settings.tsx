'use client';

import { useState } from 'react';
import { Bell, Mail, RefreshCw } from 'lucide-react';
import { Session } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { saveSettings } from './../actions';

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

  const handleSaveSettings = async () => {
    setIsSaving(true);

    // Create FormData to pass to the server action
    const formData = new FormData();
    formData.append('newDiscussions', newDiscussions ? 'on' : 'off');
    formData.append('newProposals', newProposals ? 'on' : 'off');
    formData.append('dailyRoundup', dailyRoundup ? 'on' : 'off');

    await saveSettings(formData);

    setIsSaving(false);
    // Refresh the page to show updated settings
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

  // Custom switch component
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
        className={`relative inline-flex h-6 w-11 items-center transition-colors ${
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
          className={`inline-block h-5 w-5 transform bg-white transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]' }`}
        />
      </div>
    );
  };

  return (
    <div className='container w-full py-10'>
      <h1 className='mb-6 text-3xl font-bold'>Notification Settings</h1>

      <div
        className='border-card-foreground border-neutral-350 dark:border-neutral-650 rounded-lg
          border bg-neutral-50 dark:bg-neutral-950'
      >
        <div className='px-6 pt-6 pb-2'>
          <h2 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
            Email Notifications
          </h2>
          <p className='text-muted-foreground text-sm text-neutral-500 dark:text-neutral-400'>
            Configure how and when you receive email notifications
          </p>
        </div>
        <div className='space-y-6 px-6 py-4'>
          <div className='flex items-center justify-between space-x-2'>
            <div className='flex items-start space-x-3'>
              <Bell className='text-muted-foreground mt-0.5 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
              <div>
                <label
                  htmlFor='new-discussions'
                  className='text-base font-medium text-neutral-900 dark:text-neutral-100'
                >
                  New discussions
                </label>
                <p className='text-muted-foreground text-sm text-neutral-500 dark:text-neutral-400'>
                  Receive an email when a new discussion is created
                </p>
              </div>
            </div>
            <Toggle
              id='new-discussions'
              checked={newDiscussions}
              onChange={setNewDiscussions}
            />
          </div>

          <div className='flex items-center justify-between space-x-2'>
            <div className='flex items-start space-x-3'>
              <Bell className='text-muted-foreground mt-0.5 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
              <div>
                <label
                  htmlFor='new-proposals'
                  className='text-base font-medium text-neutral-900 dark:text-neutral-100'
                >
                  New proposals
                </label>
                <p className='text-muted-foreground text-sm text-neutral-500 dark:text-neutral-400'>
                  Receive an email when a new proposal is submitted
                </p>
              </div>
            </div>
            <Toggle
              id='new-proposals'
              checked={newProposals}
              onChange={setNewProposals}
            />
          </div>

          <div className='flex items-center justify-between space-x-2'>
            <div className='flex items-start space-x-3'>
              <Mail className='text-muted-foreground mt-0.5 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
              <div>
                <label
                  htmlFor='daily-roundup'
                  className='text-base font-medium text-neutral-900 dark:text-neutral-100'
                >
                  Daily roundup
                </label>
                <p className='text-muted-foreground text-sm text-neutral-500 dark:text-neutral-400'>
                  Receive a daily email with a summary of new discussions and
                  proposals
                </p>
              </div>
            </div>
            <Toggle
              id='daily-roundup'
              checked={dailyRoundup}
              onChange={setDailyRoundup}
            />
          </div>
        </div>
        <div className='flex justify-end border-t border-neutral-200 px-6 py-4 dark:border-neutral-700'>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className='ring-offset-background focus-visible:ring-ring inline-flex items-center
              justify-center rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium
              whitespace-nowrap text-neutral-900 transition-colors focus-visible:ring-2
              focus-visible:ring-offset-2 focus-visible:outline-none
              disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-700
              dark:text-neutral-100'
          >
            {isSaving && <RefreshCw className='mr-2 h-4 w-4 animate-spin' />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

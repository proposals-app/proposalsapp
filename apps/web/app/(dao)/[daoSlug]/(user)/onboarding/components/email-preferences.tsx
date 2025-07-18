'use client';

import { useState } from 'react';
import { Bell, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveSettings, type SettingsData } from '../../profile/actions';
import ArrowSvg from '@/public/assets/web/icons/arrow-up.svg';

export const EmailPreferences = () => {
  const router = useRouter();
  const [newDiscussions, setNewDiscussions] = useState(true);
  const [newProposals, setNewProposals] = useState(true);
  const [endingProposals, setEndingProposals] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const settingsData: SettingsData = {
      newDiscussions,
      newProposals,
      endingProposals,
      isOnboarded: true,
    };

    await saveSettings(settingsData);

    router.push('/profile');
    router.refresh();
  };

  const Toggle = ({
    checked,
    onChange,
    id,
  }: {
    checked: boolean;
    onChange: (_checked: boolean) => void;
    id: string;
  }) => {
    return (
      <div
        className={`relative inline-flex h-6 w-11 cursor-pointer items-center ${
          checked
            ? 'bg-brand-accent dark:bg-brand-accent-bright'
            : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
        onClick={() => onChange(!checked)}
        role='switch'
        aria-checked={checked}
        id={id}
        tabIndex={0}
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
    <div className='flex w-full flex-col items-center justify-center p-4 md:min-h-screen'>
      <div className='w-full max-w-2xl'>
        <div className='mb-8 text-center'>
          <h1 className='mb-2 text-3xl font-bold'>Welcome to proposals.app!</h1>
          <p className='text-neutral-600 dark:text-neutral-400'>
            Let&apos;s customize your notification preferences to keep you
            informed about what matters most.
          </p>
        </div>

        <div className='border-neutral-350 dark:border-neutral-650 border bg-neutral-50 shadow-lg dark:bg-neutral-950'>
          <div className='p-6'>
            <h2 className='mb-6 text-xl font-semibold'>Email Notifications</h2>

            <div className='space-y-6'>
              {/* New discussions setting */}
              <div className='flex items-center justify-between'>
                <div className='flex items-start space-x-3'>
                  <Bell className='mt-1 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
                  <div>
                    <label className='font-medium'>New discussions</label>
                    <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                      Get notified when new discussions are created
                    </p>
                  </div>
                </div>
                <Toggle
                  id='new-discussions'
                  checked={newDiscussions}
                  onChange={setNewDiscussions}
                />
              </div>

              {/* New proposals setting */}
              <div className='flex items-center justify-between'>
                <div className='flex items-start space-x-3'>
                  <Bell className='mt-1 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
                  <div>
                    <label className='font-medium'>New proposals</label>
                    <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                      Get notified when new proposals are submitted
                    </p>
                  </div>
                </div>
                <Toggle
                  id='new-proposals'
                  checked={newProposals}
                  onChange={setNewProposals}
                />
              </div>

              {/* Ending proposals setting */}
              <div className='flex items-center justify-between'>
                <div className='flex items-start space-x-3'>
                  <Mail className='mt-1 h-5 w-5 text-neutral-500 dark:text-neutral-400' />
                  <div>
                    <label className='font-medium'>Ending proposals</label>
                    <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                      Get an email 24h before a proposal ends
                    </p>
                  </div>
                </div>
                <Toggle
                  id='ending-proposals'
                  checked={endingProposals}
                  onChange={setEndingProposals}
                />
              </div>
            </div>
          </div>

          <div className='border-t border-neutral-200 p-6 dark:border-neutral-700'>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className='flex w-full items-center justify-center space-x-2 bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200'
            >
              <span>Continue</span>
              <ArrowSvg className='rotate-90' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

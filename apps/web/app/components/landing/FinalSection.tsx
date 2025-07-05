'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/app/components/ui';
import Link from 'next/link';

export function FinalSection() {
  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  return (
    <div ref={ref} className='flex h-full flex-col'>
      {/* Main Content */}
      <div className='flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-0 lg:px-8'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className='mx-auto max-w-4xl text-center'
        >
          <h2 className='mb-6 text-3xl font-bold text-zinc-100 sm:mb-8 sm:text-4xl lg:text-5xl'>
            Ready to Transform Your Governance Experience?
          </h2>

          <div className='mb-8 flex justify-center sm:mb-12'>
            <Link href='/docs'>
              <Button
                size='lg'
                className='bg-zinc-100 px-6 text-sm text-zinc-900 transition-colors hover:bg-white sm:px-8 sm:text-base'
              >
                View Documentation
              </Button>
            </Link>
          </div>

          <div className='text-xs text-zinc-400 sm:text-sm'>
            <p>Open source • Built for DAOs</p>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className='border-t border-zinc-800 px-4 py-6 sm:px-6 sm:py-8 lg:px-8'>
        <div className='mx-auto max-w-7xl'>
          <div className='mb-6 grid grid-cols-2 gap-6 sm:mb-8 sm:gap-8 md:grid-cols-4'>
            <div>
              <h4 className='mb-2 text-xs font-semibold text-zinc-100 sm:mb-3 sm:text-sm'>
                Product
              </h4>
              <ul className='space-y-1.5 text-xs text-zinc-400 sm:space-y-2 sm:text-sm'>
                <li>
                  <a href='#' className='transition-colors hover:text-zinc-100'>
                    Roadmap
                  </a>
                </li>
                <li>
                  <a href='#' className='transition-colors hover:text-zinc-100'>
                    Changelog
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className='mb-2 text-xs font-semibold text-zinc-100 sm:mb-3 sm:text-sm'>
                Resources
              </h4>
              <ul className='space-y-1.5 text-xs text-zinc-400 sm:space-y-2 sm:text-sm'>
                <li>
                  <a
                    href='/docs'
                    className='transition-colors hover:text-zinc-100'
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href='https://github.com/proposals-app'
                    className='transition-colors hover:text-zinc-100'
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className='mb-2 text-xs font-semibold text-zinc-100 sm:mb-3 sm:text-sm'>
                Community
              </h4>
              <ul className='space-y-1.5 text-xs text-zinc-400 sm:space-y-2 sm:text-sm'>
                <li>
                  <a
                    href='https://discord.gg/proposalsapp'
                    className='transition-colors hover:text-zinc-100'
                  >
                    Discord
                  </a>
                </li>
                <li>
                  <a
                    href='https://twitter.com/proposalsapp'
                    className='transition-colors hover:text-zinc-100'
                  >
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className='mb-2 text-xs font-semibold text-zinc-100 sm:mb-3 sm:text-sm'>
                Legal
              </h4>
              <ul className='space-y-1.5 text-xs text-zinc-400 sm:space-y-2 sm:text-sm'>
                <li>
                  <a href='#' className='transition-colors hover:text-zinc-100'>
                    Privacy
                  </a>
                </li>
                <li>
                  <a href='#' className='transition-colors hover:text-zinc-100'>
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className='border-t border-zinc-800 pt-4 text-center text-xs text-zinc-400 sm:pt-6 sm:text-sm'>
            <p>
              © {new Date().getFullYear()} ProposalsApp. The unified platform
              for DAO governance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

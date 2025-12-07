'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

interface DaoLogo {
  name: string;
  logo: string;
  link: string;
}

interface HeroClientProps {
  activeProposals: number;
  daoLogos: DaoLogo[];
}

export function HeroClient({ activeProposals, daoLogos }: HeroClientProps) {
  return (
    <div className='relative flex h-full items-center justify-center pb-[env(safe-area-inset-bottom)]'>
      {/* Hero Content */}
      <div className='w-full px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial='initial'
          animate='animate'
          variants={staggerChildren}
          className='mx-auto max-w-5xl text-center'
        >
          <div className='text-4xl font-black tracking-tight text-stone-900 xs:text-5xl sm:text-5xl md:text-6xl lg:text-7xl'>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            >
              The vote
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 1.2 }}
              className='ml-3'
            >
              is sacred
            </motion.span>
          </div>

          <div className='mt-2 text-3xl font-black tracking-tight text-stone-900 xs:text-4xl sm:text-4xl md:text-5xl lg:text-6xl'>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 2.2 }}
            >
              a proposal,
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 3.2 }}
              className='ml-3'
            >
              divine
            </motion.span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Section with Counter and Logos */}
      <div
        className='absolute bottom-0 left-0 right-0 pb-8 sm:pb-12 md:pb-16'
        style={{
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))',
        }}
      >
        {/* Live Counter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 3.8 }}
          className='mb-6 px-4 text-center font-mono text-sm sm:mb-8 sm:text-base lg:text-lg'
        >
          <span className='inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1'>
            <span className='text-primary font-bold'>{activeProposals}</span>
            <span className='text-stone-600'>Active Proposals Across</span>
            <span className='text-primary font-bold'>{daoLogos.length}</span>
            <span className='text-stone-600'>DAOs Right Now</span>
          </span>
        </motion.div>

        {/* DAO Logos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 4.2 }}
          className='flex items-center justify-center gap-4 px-4 sm:gap-6 lg:gap-8'
        >
          {daoLogos.map((dao) => (
            <a
              key={dao.name}
              href={dao.link}
              className='opacity-60 transition-opacity hover:opacity-100'
              target='_blank'
              rel='noopener noreferrer'
            >
              <Image
                src={dao.logo}
                alt={dao.name}
                width={32}
                height={32}
                className='h-8 w-auto'
                unoptimized
              />
            </a>
          ))}
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 4.5 }}
          className='mt-3 flex justify-center'
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className='text-stone-600'
          >
            ↓
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

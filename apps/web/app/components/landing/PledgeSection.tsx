'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

export function PledgeSection() {
  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  return (
    <div
      ref={ref}
      className='flex h-full items-center justify-center px-4 sm:px-6 lg:px-8'
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8 }}
        className='mx-auto max-w-4xl text-center'
      >
        <h2 className='mb-12 text-5xl font-bold text-zinc-100 sm:text-6xl'>
          The Pledge
        </h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className='space-y-6 text-xl text-zinc-300 sm:text-2xl'
        >
          <p>We pledge to make governance accessible to everyone.</p>
          <p>We pledge to keep this platform open source forever.</p>
          <p>We pledge to put the community first, always.</p>
          <p>We pledge to never compromise on transparency.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface FeatureSectionProps {
  title: string;
  description: string;
  points?: string[];
  gifUrl?: string;
  reverse?: boolean;
  theme?: 'light' | 'dark';
}

export function FeatureSection({
  title,
  description,
  points = [],
  reverse = false,
  theme = 'light',
}: FeatureSectionProps) {
  const { ref, inView } = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  const textColor = theme === 'dark' ? 'text-zinc-100' : 'text-stone-900';
  const descriptionColor =
    theme === 'dark' ? 'text-zinc-300' : 'text-stone-700';
  const borderColor = theme === 'dark' ? 'border-zinc-700' : 'border-stone-300';
  const bgColor = theme === 'dark' ? 'bg-zinc-800/50' : 'bg-stone-200/50';
  const placeholderColor =
    theme === 'dark' ? 'text-zinc-500' : 'text-stone-500';

  return (
    <div ref={ref} className='flex h-full'>
      <div
        className={`grid h-full w-full lg:grid-cols-2 ${reverse ? 'lg:flex-row-reverse' : ''}`}
      >
        {/* GIF/Image Side - Full Half */}
        <motion.div
          className={`${reverse ? 'lg:order-2' : 'lg:order-1'} h-full ${bgColor} ${reverse ? 'border-l' : 'border-r'} ${borderColor}`}
          initial={{ opacity: 0, x: reverse ? 50 : -50 }}
          animate={
            inView
              ? { opacity: 1, x: 0 }
              : { opacity: 0, x: reverse ? 50 : -50 }
          }
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className='flex h-full w-full items-center justify-center p-8'>
            <p className={`text-2xl ${placeholderColor}`}>{title} Demo</p>
          </div>
        </motion.div>

        {/* Text Side - Full Half */}
        <motion.div
          className={`${reverse ? 'lg:order-1' : 'lg:order-2'} flex h-full items-center px-8 sm:px-12 lg:px-16`}
          initial={{ opacity: 0, x: reverse ? -50 : 50 }}
          animate={
            inView
              ? { opacity: 1, x: 0 }
              : { opacity: 0, x: reverse ? -50 : 50 }
          }
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        >
          <div className='max-w-xl'>
            <h2 className={`mb-6 text-4xl font-bold sm:text-5xl ${textColor}`}>
              {title}
            </h2>
            <p className={`mb-8 text-xl ${descriptionColor}`}>{description}</p>
            {points.length > 0 && (
              <ul className='space-y-4'>
                {points.map((point, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={
                      inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }
                    }
                    transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                    className='flex items-start gap-3'
                  >
                    <span className={`mt-0.5 text-xl ${textColor}`}>•</span>
                    <span className={`text-lg ${descriptionColor}`}>
                      {point}
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

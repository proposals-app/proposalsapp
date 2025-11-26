'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check } from 'lucide-react';

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
        className={`grid h-full w-full grid-cols-1 lg:grid-cols-2 ${reverse ? 'lg:flex-row-reverse' : ''} py-safe`}
      >
        {/* GIF/Image Side - Full Half */}
        <motion.div
          className={`${reverse ? 'lg:order-2' : 'lg:order-1'} h-full min-h-[200px] sm:min-h-[300px] lg:min-h-0 ${bgColor} ${reverse ? 'lg:border-l' : 'lg:border-r'} ${borderColor}`}
          initial={{ opacity: 0, x: reverse ? 50 : -50 }}
          animate={
            inView
              ? { opacity: 1, x: 0 }
              : { opacity: 0, x: reverse ? 50 : -50 }
          }
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className='flex h-full w-full items-center justify-center p-4 sm:p-6 lg:p-8'>
            <p className={`text-lg sm:text-xl lg:text-2xl ${placeholderColor}`}>
              {title} Demo
            </p>
          </div>
        </motion.div>

        {/* Text Side - Full Half */}
        <motion.div
          className={`${reverse ? 'lg:order-1' : 'lg:order-2'} flex h-full items-center px-4 py-8 sm:px-8 sm:py-12 md:px-12 lg:px-16 lg:py-0`}
          initial={{ opacity: 0, x: reverse ? -50 : 50 }}
          animate={
            inView
              ? { opacity: 1, x: 0 }
              : { opacity: 0, x: reverse ? -50 : 50 }
          }
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        >
          <div className='mx-auto w-full max-w-xl lg:mx-0'>
            <h2
              className={`mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl md:text-4xl lg:text-5xl ${textColor}`}
            >
              {title}
            </h2>
            <p
              className={`mb-6 text-base sm:mb-8 sm:text-lg lg:text-xl ${descriptionColor}`}
            >
              {description}
            </p>
            {points.length > 0 && (
              <ul className='space-y-3 sm:space-y-4'>
                {points.map((point, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={
                      inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }
                    }
                    transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                    className='flex items-start gap-4'
                  >
                    <div
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                        theme === 'dark' ? 'bg-zinc-700/50' : 'bg-stone-200/70'
                      }`}
                    >
                      <Check
                        className={`h-3.5 w-3.5 ${
                          theme === 'dark' ? 'text-zinc-100' : 'text-stone-800'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-sm sm:text-base lg:text-lg ${descriptionColor} leading-relaxed`}
                    >
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

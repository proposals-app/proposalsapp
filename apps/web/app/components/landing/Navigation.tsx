'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { SUPPORTED_DAOS } from './dao-config';

export function Navigation() {
  const [isLight, setIsLight] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Create an intersection observer to detect which section is most visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Check if this section is taking up most of the viewport
          if (entry.intersectionRatio > 0.5) {
            const theme = entry.target.getAttribute('data-theme');
            setIsLight(theme === 'light');
          }
        });
      },
      {
        threshold: [0.5],
      }
    );

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      // Observe all sections
      const sections = document.querySelectorAll('[data-theme]');
      sections.forEach((section) => observer.observe(section));
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <nav className='fixed top-10 right-0 left-0 z-40 flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8'>
      <div className='flex items-center gap-2'>
        <div className='relative h-8 w-8'>
          <img
            src='/assets/logo.svg'
            alt='ProposalsApp'
            className={`absolute inset-0 h-8 w-8 transition-opacity duration-500 ${
              isLight ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <img
            src='/assets/logo_dark.svg'
            alt='ProposalsApp'
            className={`absolute inset-0 h-8 w-8 transition-opacity duration-500 ${
              isLight ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </div>
      </div>

      {/* Desktop Menu */}
      <div className='hidden items-center gap-6 sm:flex'>
        {SUPPORTED_DAOS.map((dao, index) => (
          <>
            <Link
              key={dao.name}
              href={dao.link}
              className={`hidden transition-colors duration-300 sm:block ${
                isLight
                  ? 'text-zinc-700 hover:text-zinc-900'
                  : 'text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {dao.name}
            </Link>
            {index < SUPPORTED_DAOS.length - 1 && (
              <span
                key={`separator-${index}`}
                className={`hidden sm:block ${
                  isLight ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                |
              </span>
            )}
          </>
        ))}
        <span
          className={`hidden sm:block ${
            isLight ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          |
        </span>
        <Link
          href='/docs'
          className={`hidden transition-colors duration-300 sm:block ${
            isLight
              ? 'text-zinc-700 hover:text-zinc-900'
              : 'text-zinc-300 hover:text-zinc-100'
          }`}
        >
          Docs
        </Link>
        <Link
          href='https://github.com/proposals-app'
          className={`hidden transition-colors duration-300 sm:block ${
            isLight
              ? 'text-zinc-700 hover:text-zinc-900'
              : 'text-zinc-300 hover:text-zinc-100'
          }`}
        >
          GitHub
        </Link>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className={`p-2 transition-colors duration-300 sm:hidden ${
          isLight ? 'text-zinc-700' : 'text-zinc-300'
        }`}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className='fixed inset-x-0 top-24 mx-4 rounded-lg shadow-lg backdrop-blur-lg transition-all duration-300 sm:hidden'>
          <div
            className={`space-y-3 p-4 ${
              isLight ? 'bg-white/90' : 'bg-zinc-900/90'
            }`}
          >
            {SUPPORTED_DAOS.map((dao) => (
              <Link
                key={dao.name}
                href={dao.link}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2 transition-colors duration-300 ${
                  isLight
                    ? 'text-zinc-700 hover:text-zinc-900'
                    : 'text-zinc-300 hover:text-zinc-100'
                }`}
              >
                {dao.name}
              </Link>
            ))}
            <div className={`border-t ${isLight ? 'border-zinc-200' : 'border-zinc-700'} my-2`} />
            <Link
              href='/docs'
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 transition-colors duration-300 ${
                isLight
                  ? 'text-zinc-700 hover:text-zinc-900'
                  : 'text-zinc-300 hover:text-zinc-100'
              }`}
            >
              Docs
            </Link>
            <Link
              href='https://github.com/proposals-app'
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 transition-colors duration-300 ${
                isLight
                  ? 'text-zinc-700 hover:text-zinc-900'
                  : 'text-zinc-300 hover:text-zinc-100'
              }`}
            >
              GitHub
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

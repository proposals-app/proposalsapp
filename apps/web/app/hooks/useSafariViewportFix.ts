'use client';

import { useEffect } from 'react';

export function useSafariViewportFix() {
  useEffect(() => {
    // Function to set the viewport height
    const setViewportHeight = () => {
      // Get the actual viewport height
      const vh = window.innerHeight * 0.01;
      // Set it as a CSS custom property
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set the initial height
    setViewportHeight();

    // Update on resize and orientation change
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    // For iOS Safari, also listen to scroll events
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setViewportHeight();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Only add scroll listener on iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      if (isIOS) {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);
}
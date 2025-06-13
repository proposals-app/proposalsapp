import React from 'react';
import type { Decorator } from '@storybook/react';

/**
 * Chromatic decorator that provides consistent visual testing modes
 * Ensures components are rendered in a stable state for visual regression testing
 */
export const chromaticDecorator: Decorator = (Story, context) => {
  const { parameters } = context;
  const chromaticParams = parameters.chromatic || {};

  // Add CSS to disable animations if configured
  const disableAnimations = chromaticParams.pauseAnimationAtEnd;
  
  return (
    <div data-chromatic="true">
      {disableAnimations && (
        <style>
          {`
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `}
        </style>
      )}
      <Story />
    </div>
  );
};

/**
 * Visual testing modes for different types of components
 */
export const chromaticModes = {
  // Standard mode for most components
  default: {
    chromatic: {
      viewports: [320, 768, 1200],
      delay: 300,
      pauseAnimationAtEnd: true,
    },
  },
  
  // Layout mode for components that need layout shift testing
  layout: {
    chromatic: {
      viewports: [320, 768, 1200],
      delay: 500,
      pauseAnimationAtEnd: true,
      diffThreshold: 0.1, // More sensitive for layout changes
    },
  },
  
  // Interactive mode for components with hover/focus states
  interactive: {
    chromatic: {
      viewports: [768, 1200], // Focus on desktop for interactions
      delay: 200,
      pauseAnimationAtEnd: false, // Allow animations for interaction states
      modes: {
        hover: { hover: true },
        focus: { focus: true },
      },
    },
  },
  
  // Mobile-first mode for responsive components
  mobile: {
    chromatic: {
      viewports: [320, 768],
      delay: 300,
      pauseAnimationAtEnd: true,
    },
  },
  
  // Desktop-only mode for complex layouts
  desktop: {
    chromatic: {
      viewports: [1200, 1600],
      delay: 400,
      pauseAnimationAtEnd: true,
    },
  },
};

/**
 * Viewport configurations for different screen sizes
 */
export const chromaticViewports = {
  mobile: [320, 375],
  tablet: [768, 1024],
  desktop: [1200, 1600],
  all: [320, 768, 1200, 1600],
  responsive: [320, 768, 1200],
};
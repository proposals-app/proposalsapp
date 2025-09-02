import { useEffect, useRef } from 'react';
import { useChannel } from 'storybook/preview-api';
import type { Decorator } from '@storybook/react';
import { EVENTS } from './constants';

interface ElementData {
  tagName: string;
  id: string | null;
  className: string | null;
  path: string;
  dimensions: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
  text?: string;
}

function getElementPath(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;

  while (
    current &&
    current !== document.body &&
    !current.hasAttribute('data-story-root')
  ) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    }

    if (current.className) {
      const classString =
        typeof current.className === 'string'
          ? current.className
          : (current.className as any)?.baseVal || '';

      if (classString) {
        const classes = classString.split(' ').filter(Boolean);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

function measureElement(element: Element): ElementData {
  const rect = element.getBoundingClientRect();
  // Unused but kept for potential future use
  // const _computedStyle = window.getComputedStyle(element);

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className:
      typeof element.className === 'string'
        ? element.className
        : (element.className as any)?.baseVal || null,
    path: getElementPath(element),
    dimensions: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
    },
    text: element.textContent?.trim().slice(0, 50),
  };
}

function measureStoryElements(): ElementData[] {
  const results: ElementData[] = [];
  const storyRoot = document.querySelector('[data-story-root="true"]');

  if (!storyRoot) {
    console.warn('Could not find story root element');
    return [];
  }

  const walker = document.createTreeWalker(storyRoot, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const element = node as Element;
      const skipTags = ['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD'];
      if (skipTags.includes(element.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    try {
      const elementData = measureElement(currentNode as Element);
      results.push(elementData);
    } catch (error) {
      console.warn('Failed to measure element:', currentNode, error);
    }
  }

  return results;
}

export const withDomSizer: Decorator = (Story, context) => {
  const storyIdRef = useRef<string | null>(null);

  const emit = useChannel({
    [EVENTS.REQUEST_MEASURE]: () => {
      // Small delay to ensure story is rendered
      setTimeout(() => {
        const measurements = measureStoryElements();
        emit(EVENTS.RESULT, measurements);
      }, 100);
    },
  });

  // Detect story changes and auto-measure
  useEffect(() => {
    const currentStoryId = context.id;

    if (storyIdRef.current !== currentStoryId) {
      storyIdRef.current = currentStoryId;

      // Emit story change event
      emit(EVENTS.STORY_CHANGED);

      // Auto-measure after a delay to ensure story is rendered
      setTimeout(() => {
        const measurements = measureStoryElements();
        emit(EVENTS.RESULT, measurements);
      }, 300);
    }
  }, [context.id, emit]);

  return (
    <div data-story-root='true'>
      <Story />
    </div>
  );
};

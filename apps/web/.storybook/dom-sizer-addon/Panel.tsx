import React, { useState, useCallback, useEffect } from 'react';
import { useChannel } from 'storybook/manager-api';
import { AddonPanel } from 'storybook/internal/components';
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

export const Panel: React.FC = ({ active }: any) => {
  if (!active) return null;
  const [results, setResults] = useState<ElementData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const emit = useChannel({
    [EVENTS.RESULT]: (data: ElementData[]) => {
      setResults(data);
      setIsLoading(false);
    },
    [EVENTS.STORY_CHANGED]: () => {
      setIsLoading(true);
      // Small delay to ensure story is fully loaded
      setTimeout(() => {
        emit(EVENTS.REQUEST_MEASURE);
      }, 300);
    },
  });

  // Auto-measure when panel becomes active
  useEffect(() => {
    if (active) {
      setIsLoading(true);
      emit(EVENTS.REQUEST_MEASURE);
    }
  }, [active, emit]);

  const handleMeasure = useCallback(() => {
    setIsLoading(true);
    emit(EVENTS.REQUEST_MEASURE);
  }, [emit]);

  return (
    <AddonPanel active={active}>
      <div
        style={{ padding: '16px', fontFamily: 'monospace', fontSize: '12px' }}
      >
        {isLoading && (
          <div
            style={{
              marginBottom: '16px',
              padding: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              color: '#666',
              fontSize: '11px',
            }}
          >
            🔄 Auto-measuring DOM elements...
          </div>
        )}
        {results.length > 0 && (
          <div
            style={{
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={handleMeasure}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f8f9fa',
                color: '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              🔄 Refresh
            </button>
          </div>
        )}

        {results.length > 0 ? (
          <div>
            <div style={{ marginBottom: '8px', color: '#666' }}>
              Found {results.length} elements
            </div>
            <div>
              <div
                style={{ marginBottom: '8px', color: '#666', fontSize: '11px' }}
              >
                Full JSON Output (all {results.length} elements):
              </div>
              <pre
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: 'none',
                  height: 'auto',
                  minHeight: '400px',
                  fontSize: '10px',
                  lineHeight: '1.2',
                  border: '1px solid #ddd',
                }}
              >
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        ) : !isLoading ? (
          <div
            style={{
              color: '#666',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px dashed #dee2e6',
            }}
          >
            📊 DOM analysis will appear here automatically when stories load
          </div>
        ) : null}
      </div>
    </AddonPanel>
  );
};

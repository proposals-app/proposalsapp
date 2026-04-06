import { describe, expect, it } from 'vitest';
import { resolvePiToolTransport } from './tool-transport';

describe('resolvePiToolTransport', () => {
  it('defaults Gemma models on LM Studio to the text-action shim', () => {
    expect(
      resolvePiToolTransport({
        provider: 'lmstudio',
        model: 'google/gemma-4-31b',
        baseUrl: 'http://ai-box:1234/v1',
        configuredMode: 'auto',
      })
    ).toBe('text-actions');
  });

  it('defaults non-Gemma LM Studio models to native tools', () => {
    expect(
      resolvePiToolTransport({
        provider: 'lmstudio',
        model: 'qwen/qwen3-32b',
        baseUrl: 'http://ai-box:1234/v1',
        configuredMode: 'auto',
      })
    ).toBe('native');
  });

  it('honors explicit transport overrides', () => {
    expect(
      resolvePiToolTransport({
        provider: 'lmstudio',
        model: 'qwen/qwen3-32b',
        baseUrl: 'http://ai-box:1234/v1',
        configuredMode: 'text-actions',
      })
    ).toBe('text-actions');

    expect(
      resolvePiToolTransport({
        provider: 'lmstudio',
        model: 'google/gemma-4-31b',
        baseUrl: 'http://ai-box:1234/v1',
        configuredMode: 'native',
      })
    ).toBe('native');
  });

  it('keeps non-lmstudio OpenAI-compatible providers on native tools', () => {
    expect(
      resolvePiToolTransport({
        provider: 'openrouter',
        model: 'openai/gpt-5.4-nano',
        baseUrl: 'https://openrouter.ai/api/v1',
        configuredMode: 'auto',
      })
    ).toBe('native');
  });
});

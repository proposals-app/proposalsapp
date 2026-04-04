export type PiToolTransportMode = 'auto' | 'native' | 'text-actions';
export type PiResolvedToolTransport = 'native' | 'text-actions';

function isLmStudioGemmaModel(model: string): boolean {
  return /\bgemma\b/i.test(model);
}

export function resolvePiToolTransport(input: {
  provider: string;
  model: string;
  baseUrl?: string | null;
  configuredMode?: PiToolTransportMode;
}): PiResolvedToolTransport {
  const configuredMode = input.configuredMode ?? 'auto';
  if (configuredMode === 'native' || configuredMode === 'text-actions') {
    return configuredMode;
  }

  if (input.provider !== 'lmstudio' || !input.baseUrl) {
    return 'native';
  }

  return isLmStudioGemmaModel(input.model) ? 'text-actions' : 'native';
}

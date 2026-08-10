export function isQwenModelId(model: string | null | undefined): boolean {
  const normalized = model?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('qwen') ||
    normalized.includes('/qwen') ||
    normalized.includes('-qwen') ||
    normalized.includes('_qwen')
  );
}

export function isGemma4ModelId(model: string | null | undefined): boolean {
  const normalized = model?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('gemma-4') ||
    normalized.includes('/gemma-4') ||
    normalized.includes('-gemma-4') ||
    normalized.includes('_gemma-4')
  );
}

export function isMuseGlimmerModelId(
  model: string | null | undefined
): boolean {
  const normalized = model?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('muse-glimmer') ||
    normalized.includes('/muse-glimmer') ||
    normalized.includes('-muse-glimmer') ||
    normalized.includes('_muse-glimmer')
  );
}

export function isLmStudioQwenModel(input: {
  provider: string | null | undefined;
  model: string | null | undefined;
}): boolean {
  return (
    input.provider?.toLowerCase() === 'lmstudio' && isQwenModelId(input.model)
  );
}

export function isLmStudioGemma4Model(input: {
  provider: string | null | undefined;
  model: string | null | undefined;
}): boolean {
  return (
    input.provider?.toLowerCase() === 'lmstudio' && isGemma4ModelId(input.model)
  );
}

export function isLmStudioMuseGlimmerModel(input: {
  provider: string | null | undefined;
  model: string | null | undefined;
}): boolean {
  return (
    input.provider?.toLowerCase() === 'lmstudio' &&
    isMuseGlimmerModelId(input.model)
  );
}

export function isLmStudioReasoningModel(input: {
  provider: string | null | undefined;
  model: string | null | undefined;
}): boolean {
  return (
    isLmStudioQwenModel(input) ||
    isLmStudioGemma4Model(input) ||
    isLmStudioMuseGlimmerModel(input)
  );
}

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

export function isLmStudioQwenModel(input: {
  provider: string | null | undefined;
  model: string | null | undefined;
}): boolean {
  return (
    input.provider?.toLowerCase() === 'lmstudio' && isQwenModelId(input.model)
  );
}

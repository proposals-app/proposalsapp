function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function isDryRunEnabled(): boolean {
  return parseBoolean(process.env.MAPPING_AGENT_DRY_RUN);
}

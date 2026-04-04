export function textToolResponse(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
    details: {},
  };
}

export function errorToolResponse(error: unknown) {
  return textToolResponse({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

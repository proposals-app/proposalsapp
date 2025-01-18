"use server";

import { type Span, trace } from "@opentelemetry/api";

export async function otel<T, Args extends unknown[]>(
  fnName: string,
  fn: (...args: Args) => Promise<T>,
  ...props: Args
): Promise<T> {
  const tracer = trace.getTracer(fnName);
  return tracer.startActiveSpan(fnName, async (span: Span) => {
    try {
      return await fn(...props);
    } finally {
      span.end();
    }
  });
}

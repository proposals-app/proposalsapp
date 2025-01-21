"use server";

import { type Span, trace } from "@opentelemetry/api";

export async function otel<T>(
  fnName: string,
  fn: (...args: any[]) => Promise<T>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ...props: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
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

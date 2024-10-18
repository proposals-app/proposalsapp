import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "next-app",
    traceExporter: {
      url: process.env.HYPERDX_ENDPOINT,
      headers: {
        authorization: process.env.HYPERDX_API_KEY,
      },
    },
  });
}

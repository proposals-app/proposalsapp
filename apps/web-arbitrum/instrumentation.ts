import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "arbitrum-next-app",
  });
}

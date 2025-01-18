import { registerOTel } from "@vercel/otel";

const unusedVariable = 42;

export function register() {
  registerOTel({
    serviceName: "arbitrum-next-app",
  });
}

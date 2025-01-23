import client from 'prom-client';

// Initialize the default metrics collection
const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();
collectDefaultMetrics({
  prefix: `${process.env.OTEL_SERVICE_NAME ?? 'app'}_`,
  register,
});

export async function GET() {
  // Get all metrics from the registry
  const metrics = await register.metrics();

  // Return the metrics as a response
  return new Response(metrics, {
    headers: {
      'Content-Type': register.contentType,
    },
  });
}

import client from 'prom-client';

// Initialize the default metrics collection
const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();

// Ensure the prefix is a valid metric name
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'app';
const validPrefix = serviceName.replace(/[^a-zA-Z0-9_]/g, '_');

collectDefaultMetrics({
  prefix: `${validPrefix}_`,
  register,
});

export async function GET() {
  try {
    // Get all metrics from the registry
    const metrics = await register.metrics();

    // Return the metrics as a response
    return new Response(metrics, {
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}

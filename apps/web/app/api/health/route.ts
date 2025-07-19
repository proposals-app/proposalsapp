import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      environment: checkEnvironment(),
      // Don't check database in health endpoint to avoid circular dependencies
    },
  };

  // If any critical checks fail, return 503
  const hasFailures = Object.values(checks.checks).some(check => 
    typeof check === 'object' && 'status' in check && check.status === 'error'
  );

  return NextResponse.json(checks, { 
    status: hasFailures ? 503 : 200 
  });
}

function checkEnvironment() {
  const required = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `Missing required environment variables: ${missing.join(', ')}`,
    };
  }
  
  return {
    status: 'ok',
    message: 'All required environment variables are set',
  };
}

export function logToFile(componentType: string, data: any) {
  if (process.env.NODE_ENV !== 'development' || typeof window !== 'undefined') {
    return;
  }

  import('fs').then((fs) => {
    import('path').then((path) => {
      const LOG_FILE = path.join(process.cwd(), 'storybook-data.txt');
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${componentType}:\n${JSON.stringify(data, null, 2)}\n\n`;
      fs.appendFileSync(LOG_FILE, logEntry);
    });
  });
}

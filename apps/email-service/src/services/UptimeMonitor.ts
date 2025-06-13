import axios from 'axios';

export class UptimeMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private url: string,
    private intervalSeconds: number
  ) {}

  start(): void {
    if (this.intervalId) {
      console.warn('Uptime monitor already started');
      return;
    }

    console.log(
      `Starting uptime monitoring to ${this.url} every ${this.intervalSeconds} seconds`
    );

    // Initial ping
    this.ping();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.ping();
    }, this.intervalSeconds * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Uptime monitoring stopped');
    }
  }

  private async ping(): Promise<void> {
    try {
      await axios.get(this.url, { timeout: 5000 });
      console.log('Uptime ping successful');
    } catch (error) {
      console.error('Uptime ping failed:', error);
    }
  }
}

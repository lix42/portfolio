import pRetry from 'p-retry';

type Task<T> = () => Promise<T>;

class DynamicRequestQueue {
  private concurrency: number;
  private running: number;
  private queue: Task<any>[];
  private cooldown: number; // milliseconds to wait between tasks
  private lastErrorTime: number;

  constructor(
    initialConcurrency: number,
    private maxConcurrency: number = 10
  ) {
    this.concurrency = initialConcurrency;
    this.running = 0;
    this.queue = [];
    this.cooldown = 0;
    this.lastErrorTime = 0;
  }

  async add<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runTask = async () => {
        this.running++;
        try {
          await this.delayIfNeeded();

          const result = await pRetry(task, {
            retries: 5,
            factor: 2,
            minTimeout: 500,
            maxTimeout: 5000,
            onFailedAttempt: (error) => {
              console.log(
                `Task attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
              );
              if (this.isRateLimitError(error)) {
                this.handleRateLimit();
              }
            },
          });
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.next();
        }
      };

      this.queue.push(runTask);
      this.next();
    });
  }

  private next() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        task();
      }
    }
  }

  private async delayIfNeeded() {
    if (this.cooldown > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.cooldown));
    }
  }

  private isRateLimitError(error: any): boolean {
    return error.response?.status === 429;
  }

  private handleRateLimit() {
    const now = Date.now();
    if (now - this.lastErrorTime < 10000) {
      // if multiple 429s in short time, slow down harder
      this.cooldown = Math.min(this.cooldown * 2 || 1000, 10000); // cap at 10 seconds
      this.concurrency = Math.max(1, Math.floor(this.concurrency / 2)); // lower concurrency
      console.log(
        `Rate limited! New cooldown=${this.cooldown}ms, concurrency=${this.concurrency}`
      );
    }
    this.lastErrorTime = now;
  }

  // Optional: slowly recover when things are good
  public recover() {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - 100); // cool down faster
    }
    if (this.concurrency < this.maxConcurrency) {
      this.concurrency += 1; // gently increase concurrency back
    }
  }
}

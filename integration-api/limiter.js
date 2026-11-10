// limiter.js - Concurrency limiter with a bounded FIFO wait queue
//
// Replaces the earlier processPool/queueManager pair, which marked services busy
// by port without matching them to the request's model type and never ran jobs
// that were placed in the queue. Here a request either runs immediately, waits
// its turn (and then runs), or is rejected when the wait queue is full.

export class QueueFullError extends Error {
  constructor(maxQueue) {
    super(`Queue full (${maxQueue} waiting)`);
    this.name = 'QueueFullError';
  }
}

export class Limiter {
  constructor({ maxConcurrent = 3, maxQueue = 10 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.waiting = []; // { id, resolve, enqueuedAt }
  }

  // Run task() when a slot is free. Rejects with QueueFullError if the queue is full.
  async run(id, task) {
    if (this.active >= this.maxConcurrent) {
      if (this.waiting.length >= this.maxQueue) throw new QueueFullError(this.maxQueue);
      await new Promise((resolve) => {
        this.waiting.push({ id, resolve, enqueuedAt: new Date().toISOString() });
      });
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.waiting.shift();
      if (next) next.resolve();
    }
  }

  getStatus() {
    return {
      maxConcurrent: this.maxConcurrent,
      active: this.active,
      waiting: this.waiting.length,
      maxQueue: this.maxQueue,
      jobs: this.waiting.map(({ id, enqueuedAt }) => ({ id, enqueuedAt })),
    };
  }
}

const limiter = new Limiter({
  maxConcurrent: Number(process.env.MAX_CONCURRENT_ANALYSES) || 3,
  maxQueue: Number(process.env.MAX_QUEUE_SIZE) || 10,
});

export default limiter;

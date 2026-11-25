// Simulated messaging: one TOPIC that fans out to several QUEUES.
//
// Mirrors our AWS design: an SNS topic "order-events" sending a copy of every
// event to two SQS queues (payments-queue and notifications-queue).
// A single SQS queue could not do this, because each message goes to only one consumer.
//
// Like SQS, a failing consumer does not block the others: the message is
// retried, then parked in a dead-letter list.

class OrderEventTopic {
  constructor({ maxAttempts = 3 } = {}) {
    this.queues = [];
    this.maxAttempts = maxAttempts;
    this.log = []; // what was published, for debugging and the demo
  }

  // Subscribe a named queue (e.g. "payments-queue") to the topic
  subscribe(name, handler) {
    const queue = { name, handler, deadLetters: [] };
    this.queues.push(queue);
    return () => {
      this.queues = this.queues.filter((q) => q !== queue);
    };
  }

  // Every subscribed queue receives its own copy of the event
  async publish(event) {
    this.log.push({ at: new Date().toISOString(), type: event.type, orderId: event.order.id });
    if (this.log.length > 200) this.log.shift();
    await Promise.all(this.queues.map((q) => this.deliver(q, structuredClone(event))));
  }

  deadLetters(name) {
    const q = this.queues.find((x) => x.name === name);
    return q ? q.deadLetters : [];
  }

  async deliver(queue, event) {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        await queue.handler(event);
        return;
      } catch (err) {
        if (attempt === this.maxAttempts) {
          console.error(`[${queue.name}] gave up on ${event.type}:`, err.message);
          queue.deadLetters.push({ event, error: err.message });
        }
      }
    }
  }
}

module.exports = { OrderEventTopic };

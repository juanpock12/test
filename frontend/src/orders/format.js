export const euro = (cents) => `€${(cents / 100).toFixed(2)}`;

export const STATUS_LABELS = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAYMENT_FAILED: 'Payment failed',
  RECEIVED: 'Received',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected (refunded)',
};

export const TRACKING_STEPS = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED'];

export const PAYMENT_METHODS = [
  { value: 'CAMPUS_CARD', label: 'Campus Card (simulated)', hint: 'Always succeeds' },
  { value: 'TEST_CARD', label: 'Test card 4242 (simulated)', hint: 'Always succeeds' },
  { value: 'TEST_CARD_DECLINED', label: 'Test card 0002, declined', hint: 'Always fails, to demo a failed payment' },
];

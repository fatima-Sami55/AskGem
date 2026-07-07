let counter = 0;

export function newMessageId() {
  counter += 1;
  return `msg-${Date.now()}-${counter}`;
}

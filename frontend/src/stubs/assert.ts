function fail(message = "Assertion failed"): never {
  throw new Error(message);
}

function assert(value: unknown, message?: string): asserts value {
  if (!value) {
    fail(message);
  }
}

assert.ok = assert;
assert.equal = (actual: unknown, expected: unknown, message?: string): void => {
  if (actual != expected) {
    fail(message ?? `Expected ${String(actual)} == ${String(expected)}`);
  }
};
assert.strictEqual = (actual: unknown, expected: unknown, message?: string): void => {
  if (actual !== expected) {
    fail(message ?? `Expected ${String(actual)} === ${String(expected)}`);
  }
};

export default assert;

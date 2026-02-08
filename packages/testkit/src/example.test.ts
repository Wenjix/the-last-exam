import { describe, it, expect } from 'vitest';

describe('testkit example', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string assertions', () => {
    expect('the-last-exam').toContain('last');
  });

  it('should handle async assertions', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});

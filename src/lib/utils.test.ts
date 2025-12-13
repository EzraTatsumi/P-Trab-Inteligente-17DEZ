import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge Tailwind classes correctly', () => {
    const result = cn('px-4 py-2', 'bg-red-500', 'text-white');
    expect(result).toBe('px-4 py-2 bg-red-500 text-white');
  });

  it('should handle conditional classes and merge conflicts', () => {
    const result = cn(
      'text-sm font-medium',
      'p-4',
      'text-lg', // Conflict with text-sm
      'bg-blue-500',
      false && 'hidden',
      null,
      undefined,
      'p-2' // Conflict with p-4
    );
    // Expected result should prioritize the last class for conflicts (p-2, text-lg)
    expect(result).toBe('font-medium text-lg bg-blue-500 p-2');
  });

  it('should handle empty inputs', () => {
    const result = cn(null, undefined, '', false);
    expect(result).toBe('');
  });
});
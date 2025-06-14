import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '../services/CircuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  const mockFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    circuitBreaker = new CircuitBreaker(3, 1000); // threshold: 3, timeout: 1 second
  });

  describe('normal operation', () => {
    it('should execute function successfully when circuit is closed', async () => {
      mockFunction.mockResolvedValue('success');

      const result = await circuitBreaker.execute(() => mockFunction());

      expect(result).toBe('success');
      expect(mockFunction).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should reset failure count on successful execution', async () => {
      // First, cause one failure
      mockFunction.mockRejectedValueOnce(new Error('test error'));
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow('test error');

      // Then succeed
      mockFunction.mockResolvedValue('success');
      await circuitBreaker.execute(() => mockFunction());

      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('failure handling', () => {
    it('should open circuit after threshold failures', async () => {
      mockFunction.mockRejectedValue(new Error('test error'));

      // First two failures should keep circuit closed
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow('test error');
      expect(circuitBreaker.getState()).toBe('CLOSED');

      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow('test error');
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Third failure should open the circuit
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow('test error');
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should reject immediately when circuit is open', async () => {
      // Cause threshold failures to open circuit
      mockFunction.mockRejectedValue(new Error('test error'));
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => mockFunction())
        ).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Next call should be rejected immediately without calling the function
      const callCountBefore = mockFunction.mock.calls.length;
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockFunction.mock.calls.length).toBe(callCountBefore); // Function not called
    });
  });

  describe('recovery', () => {
    it('should transition to half-open after timeout', async () => {
      // Create circuit breaker with very short timeout for testing
      circuitBreaker = new CircuitBreaker(2, 100); // 100ms timeout

      // Cause failures to open circuit
      mockFunction.mockRejectedValue(new Error('test error'));
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow();
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next execution should attempt to call function (half-open state)
      mockFunction.mockResolvedValue('success');
      const result = await circuitBreaker.execute(() => mockFunction());

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should open again if function fails in half-open state', async () => {
      // Create circuit breaker with very short timeout for testing
      circuitBreaker = new CircuitBreaker(2, 100); // 100ms timeout

      // Cause failures to open circuit
      mockFunction.mockRejectedValue(new Error('test error'));
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow();
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Function fails again in half-open state
      mockFunction.mockRejectedValue(new Error('still failing'));
      await expect(
        circuitBreaker.execute(() => mockFunction())
      ).rejects.toThrow('still failing');

      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker state', async () => {
      // Cause failures to open circuit
      mockFunction.mockRejectedValue(new Error('test error'));
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => mockFunction())
        ).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Reset circuit breaker
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Should work normally after reset
      mockFunction.mockResolvedValue('success');
      const result = await circuitBreaker.execute(() => mockFunction());
      expect(result).toBe('success');
    });
  });

  describe('edge cases', () => {
    it('should handle shouldAttemptReset when lastFailureTime is null', () => {
      // Create a fresh circuit breaker with no failures
      const freshCircuitBreaker = new CircuitBreaker(3, 1000);

      // Access the private method through a workaround to test the branch
      // This tests the uncovered branch in shouldAttemptReset
      const shouldAttempt = (freshCircuitBreaker as any).shouldAttemptReset();
      expect(shouldAttempt).toBe(false);
    });
  });
});

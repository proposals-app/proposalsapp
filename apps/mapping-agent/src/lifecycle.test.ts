import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeMappingAgentResources } from './lifecycle';

const { end } = vi.hoisted(() => ({
  end: vi.fn(async () => undefined),
}));

vi.mock('@proposalsapp/db', () => ({
  dbPool: {
    end,
  },
}));

describe('closeMappingAgentResources', () => {
  afterEach(() => {
    end.mockClear();
  });

  it('closes the http server and postgres pool', async () => {
    const close = vi.fn((callback?: (error?: Error) => void) => callback?.());

    await closeMappingAgentResources({
      close,
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('still closes the postgres pool when no server exists', async () => {
    await closeMappingAgentResources(null);

    expect(end).toHaveBeenCalledTimes(1);
  });
});

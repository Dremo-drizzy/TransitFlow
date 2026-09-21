import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks forward on the given interval', () => {
    const start = new Date(2024, 0, 1, 12, 0, 0);
    vi.setSystemTime(start);

    const { result } = renderHook(() => useNow(1000));
    expect(result.current.getTime()).toBe(start.getTime());

    // vi.useFakeTimers() fakes Date too, so advanceTimersByTime alone moves
    // the clock forward — an extra vi.setSystemTime() here would double it.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.getTime()).toBe(start.getTime() + 1000);
  });

  it('stops ticking after unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useNow(1000));

    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SplitFlap from './SplitFlap';

function cellsOf(container) {
  return container.querySelectorAll('.sf-cell');
}

describe('SplitFlap', () => {
  it('renders one cell per character of `length`', () => {
    const { container } = render(<SplitFlap value="20:18" length={5} />);
    expect(cellsOf(container)).toHaveLength(5);
  });

  it('pads a short value out to `length`', () => {
    const { container } = render(<SplitFlap value="5m" length={5} />);
    const cells = cellsOf(container);
    expect(cells).toHaveLength(5);
    expect(cells[0].textContent).toBe('5');
    expect(cells[1].textContent).toBe('m');
    // Padded cells render a non-breaking space, not empty/collapsed text.
    expect(cells[2].textContent).toBe(' ');
  });

  it('truncates a long value down to `length`', () => {
    const { container } = render(<SplitFlap value="TOOLONG" length={5} />);
    const cells = cellsOf(container);
    expect(cells).toHaveLength(5);
    expect(Array.from(cells).map((c) => c.textContent).join('')).toBe('TOOLO');
  });

  it('does not mark any cell as flipping on first render', () => {
    const { container } = render(<SplitFlap value="20:18" length={5} />);
    expect(container.querySelectorAll('.sf-cell-flip')).toHaveLength(0);
  });

  it('marks only the changed indices as flipping when the value updates', () => {
    const { container, rerender } = render(<SplitFlap value="20:18" length={5} />);

    rerender(<SplitFlap value="20:19" length={5} />);

    const cells = cellsOf(container);
    const flipped = Array.from(cells).map((c) => c.classList.contains('sf-cell-flip'));
    // "20:18" -> "20:19": only the last character (index 4) changed.
    expect(flipped).toEqual([false, false, false, false, true]);
  });

  it('marks multiple changed indices when more than one character changes', () => {
    const { container, rerender } = render(<SplitFlap value="20:18" length={5} />);

    rerender(<SplitFlap value="21:19" length={5} />);

    const cells = cellsOf(container);
    const flipped = Array.from(cells).map((c) => c.classList.contains('sf-cell-flip'));
    // "20:18" -> "21:19": index 1 ('0'->'1') and index 4 ('8'->'9') changed.
    expect(flipped).toEqual([false, true, false, false, true]);
  });

  it('applies the requested tone as a class', () => {
    const { container } = render(<SplitFlap value="OK" length={2} tone="green" />);
    expect(container.querySelector('.split-flap-green')).not.toBeNull();
  });

  it('defaults to the md size', () => {
    const { container } = render(<SplitFlap value="OK" length={2} />);
    expect(container.querySelector('.split-flap-md')).not.toBeNull();
  });

  it('applies the requested size as a class', () => {
    const { container: sm } = render(<SplitFlap value="OK" length={2} size="sm" />);
    expect(sm.querySelector('.split-flap-sm')).not.toBeNull();

    const { container: lg } = render(<SplitFlap value="OK" length={2} size="lg" />);
    expect(lg.querySelector('.split-flap-lg')).not.toBeNull();
  });

  it('does not render a pulse overlay by default, even when the value changes', () => {
    const { container, rerender } = render(<SplitFlap value="12" length={2} />);
    rerender(<SplitFlap value="14" length={2} />);
    expect(container.querySelector('.sf-pulse-overlay')).toBeNull();
  });

  it('does not render a pulse overlay on first render even with pulseOnChange', () => {
    const { container } = render(<SplitFlap value="12" length={2} pulseOnChange />);
    expect(container.querySelector('.sf-pulse-overlay')).toBeNull();
  });

  it('renders a pulse overlay when pulseOnChange is set and the value changes', () => {
    const { container, rerender } = render(<SplitFlap value="12" length={2} pulseOnChange />);
    rerender(<SplitFlap value="14" length={2} pulseOnChange />);
    expect(container.querySelector('.sf-pulse-overlay')).not.toBeNull();
  });
});

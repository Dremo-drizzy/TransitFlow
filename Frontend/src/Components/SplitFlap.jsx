import { useState } from 'react';
import '../css/SplitFlap.css';

function normalize(value, length) {
  const str = String(value ?? '');
  return str.length >= length ? str.slice(0, length) : str.padEnd(length, ' ');
}

/**
 * A mechanical split-flap readout: <SplitFlap value="20:18" length={5} tone="amber" />.
 *
 * Only the characters that actually changed since the last render flip —
 * flipping the whole row on every tick would look like a loading spinner,
 * not a departure board catching up to a new time.
 */
export default function SplitFlap({ value, length, tone = 'amber' }) {
  const normalized = normalize(value, length);

  const [prevValue, setPrevValue] = useState(normalized);
  const [bump, setBump] = useState(0);
  const [changedIndices, setChangedIndices] = useState(null);

  // Comparing against the previous render's value here (React's sanctioned
  // "adjust state during render" escape hatch, not a ref) means the flip
  // class is present on the very first paint after a change, instead of
  // one render behind an effect. React re-renders immediately when state
  // changes during render, so this doesn't cause a visible extra frame.
  if (normalized !== prevValue) {
    const changed = new Set();
    for (let i = 0; i < normalized.length; i++) {
      if (prevValue[i] !== normalized[i]) changed.add(i);
    }
    setChangedIndices(changed);
    setBump((b) => b + 1);
    setPrevValue(normalized);
  }

  return (
    <div className={`split-flap split-flap-${tone}`}>
      {normalized.split('').map((char, i) => {
        const flipped = changedIndices?.has(i) ?? false;
        return (
          <span
            // The bump counter forces a fresh key on every change so the
            // flip animation re-triggers even if a character cycles back
            // to a value it already held.
            key={`${i}-${bump}`}
            className={flipped ? 'sf-cell sf-cell-flip' : 'sf-cell'}
            style={flipped ? { animationDelay: `${i * 30}ms` } : undefined}
          >
            {char === ' ' ? ' ' : char}
          </span>
        );
      })}
    </div>
  );
}

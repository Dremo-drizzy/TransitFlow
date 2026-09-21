import SplitFlap from './SplitFlap';
import '../css/FlapTime.css';

/**
 * Renders "HH:MM" as two SplitFlap groups with the colon as a plain
 * separator between them, not a flap of its own — a flap that can only
 * ever show ":" would never flip. On a real board the colon lives in the
 * housing between the hour and minute groups, not on a tile.
 */
export default function FlapTime({ value, tone = 'amber', size = 'md', cancelled = false }) {
  const [hh = '--', mm = '--'] = String(value ?? '').split(':');

  return (
    <span
      // Reuses SplitFlap's own size classes to pick up --sf-size, so the
      // colon's scale never drifts out of sync with the flap groups on
      // either side of it.
      className={`flap-time split-flap-${size}${cancelled ? ' flap-time-cancelled' : ''}`}
    >
      <SplitFlap value={hh} length={2} tone={tone} size={size} />
      <span className={`flap-colon split-flap-${tone}`}>:</span>
      <SplitFlap value={mm} length={2} tone={tone} size={size} />
    </span>
  );
}

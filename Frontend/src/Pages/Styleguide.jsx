import { useState } from 'react';
import { Container } from 'react-bootstrap';
import SplitFlap from '../Components/SplitFlap';
import '../css/Styleguide.css';

// Temporary — deleted at the end of Stage 4 once the tokens have been
// applied everywhere and there's nothing left to preview in isolation.
const TOKENS = [
  ['--tf-void', '#08090b'],
  ['--tf-housing', '#101216'],
  ['--tf-flap', '#1a1d23'],
  ['--tf-flap-dark', '#0b0d10'],
  ['--tf-edge', '#252a32'],
  ['--tf-amber', '#ffb302'],
  ['--tf-amber-dim', '#8a6100'],
  ['--tf-green', '#3ddc84'],
  ['--tf-red', '#ff5a5f'],
  ['--tf-text', '#e9e7e2'],
  ['--tf-muted', '#767f8c'],
];

const DEMO_VALUES = ['20:18', '20:19', '20:07', '21:42'];

export default function Styleguide() {
  const [demoIndex, setDemoIndex] = useState(0);
  const demoValue = DEMO_VALUES[demoIndex];

  return (
    <Container fluid="lg" className="styleguide-page py-5">
      <h1 className="sg-heading">TransitFlow Design System</h1>
      <p className="sg-subhead">Stage 3 — tokens, type, and the SplitFlap component.</p>

      <section className="sg-section">
        <h2 className="sg-section-title">Palette</h2>
        <div className="sg-swatch-grid">
          {TOKENS.map(([name, hex]) => (
            <div className="sg-swatch" key={name}>
              <div className="sg-swatch-color" style={{ background: `var(${name})` }} />
              <div className="sg-swatch-label">{name}</div>
              <div className="sg-swatch-hex">{hex}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="sg-section">
        <h2 className="sg-section-title">Type</h2>
        <p className="sg-font-mono">IBM Plex Mono — 20:18 · PLATFORM 4 · +7 MIN</p>
        <p className="sg-font-mono sg-font-bold">IBM Plex Mono 700 — DEPARTURES</p>
        <p className="sg-font-sans">
          Inter — Real-time departures, smart journey planning, and saved commutes.
        </p>
        <p className="sg-font-sans sg-font-heavy">Inter 800 — Your city, on schedule.</p>
      </section>

      <section className="sg-section">
        <h2 className="sg-section-title">SplitFlap</h2>

        {['sm', 'md', 'lg'].map((size) => (
          <div className="sg-flap-size-row" key={size}>
            <div className="sg-flap-size-label">{size}</div>
            <div className="sg-flap-row">
              <SplitFlap value={demoValue} length={5} tone="amber" size={size} />
              <SplitFlap value={demoValue} length={5} tone="green" size={size} />
              <SplitFlap value={demoValue} length={5} tone="red" size={size} />
              <SplitFlap value={demoValue} length={5} tone="muted" size={size} />
            </div>
          </div>
        ))}

        <button
          type="button"
          className="sg-flap-button"
          onClick={() => setDemoIndex((i) => (i + 1) % DEMO_VALUES.length)}
        >
          Change value
        </button>
      </section>
    </Container>
  );
}

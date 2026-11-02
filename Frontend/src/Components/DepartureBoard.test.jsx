import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DepartureBoard from './DepartureBoard';
import { useDepartures } from '../hooks/useDepartures';

vi.mock('../hooks/useDepartures', () => ({ useDepartures: vi.fn() }));

const query = (departures) => ({
  data: { departures },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  dataUpdatedAt: Date.now(),
});

// Berlin Hbf's board lists the same bus trip twice: once at the station, once
// at the Lehrter Str. stop next to it. Keyed by tripId alone, React could not
// tell the two rows apart and left orphans in the DOM when the list changed.
const twinTrips = [
  {
    tripId: 'bus-123', plannedWhen: '2026-11-02T14:15:00Z', when: '2026-11-02T14:15:00Z',
    direction: 'Saatwinkler Damm', line: { name: '123' }, stop: { id: 'hbf', name: 'S+U Berlin Hauptbahnhof' },
  },
  {
    tripId: 'bus-123', plannedWhen: '2026-11-02T14:17:00Z', when: '2026-11-02T14:17:00Z',
    direction: 'Saatwinkler Damm', line: { name: '123' }, stop: { id: 'lehrter', name: 'Lehrter Str./Invalidenstr. (Berlin)' },
  },
];

function renderBoard() {
  return render(
    <MemoryRouter>
      <DepartureBoard stopId="hbf" stationName="Berlin Hbf" />
    </MemoryRouter>
  );
}

describe('DepartureBoard', () => {
  beforeEach(() => vi.mocked(useDepartures).mockReset());

  it('gives every row a unique key when the same trip is listed twice', () => {
    // React reports duplicate keys through console.error in development; on
    // the live board those duplicates left orphaned rows after a filter change.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(useDepartures).mockReturnValue(query(twinTrips));
    renderBoard();
    const keyWarnings = errors.mock.calls.filter((args) => String(args[0]).includes('same key'));
    errors.mockRestore();
    expect(keyWarnings).toHaveLength(0);
  });

  it('leaves no rows behind when a list with a repeated trip becomes empty', () => {
    vi.mocked(useDepartures).mockReturnValue(query(twinTrips));
    const { container, rerender } = renderBoard();
    expect(container.querySelectorAll('.db-data-row')).toHaveLength(2);

    vi.mocked(useDepartures).mockReturnValue(query([]));
    rerender(
      <MemoryRouter>
        <DepartureBoard stopId="hbf" stationName="Berlin Hbf" filters={{ bus: false }} />
      </MemoryRouter>
    );

    expect(screen.getByText(/no departures/i)).toBeInTheDocument();
    expect(container.querySelectorAll('.db-data-row')).toHaveLength(0);
  });

  it('names the nearby stop, but not the station itself', () => {
    vi.mocked(useDepartures).mockReturnValue(query(twinTrips));
    renderBoard();
    expect(screen.getByText('from Lehrter Str./Invalidenstr. (Berlin)')).toBeInTheDocument();
    expect(screen.queryByText(/from S\+U Berlin Hauptbahnhof/)).not.toBeInTheDocument();
  });

  it('shows the real time first and the planned time struck through for a late departure', () => {
    vi.mocked(useDepartures).mockReturnValue(query([
      {
        tripId: 'x35', plannedWhen: '2026-11-02T12:37:00Z', when: '2026-11-02T14:11:00Z',
        direction: 'Hamburg', line: { name: 'X35' }, stop: { id: 'hh', name: 'Hamburg Hbf' },
      },
    ]));
    const { container } = render(
      <MemoryRouter>
        <DepartureBoard stopId="hh" stationName="Hamburg Hbf" />
      </MemoryRouter>
    );
    // FlapTime renders each digit in its own cell.
    const flapText = container.querySelector('.db-time .flap-time').textContent.replace(/\s/g, '');
    expect(flapText).toBe('15:11');
    expect(container.querySelector('.db-planned-time').textContent).toContain('13:37');
  });
});

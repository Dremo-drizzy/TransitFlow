import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlanJourney from './PlanJourney';
import { useJourneys } from '../hooks/useJourneys';

vi.mock('../hooks/useJourneys', () => ({ useJourneys: vi.fn() }));
vi.mock('../hooks/useLocation', () => ({ useLocations: () => ({ data: [], isLoading: false }) }));

const lastParams = () => vi.mocked(useJourneys).mock.calls.at(-1)[0];

function renderPlan(url = '/plan?from=A&fromName=Berlin%20Hbf&to=B&toName=Hamburg%20Hbf') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PlanJourney />
    </MemoryRouter>
  );
}

describe('PlanJourney', () => {
  beforeEach(() => {
    vi.mocked(useJourneys).mockReset();
    vi.mocked(useJourneys).mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  it('searches straight away when the link names both stations', () => {
    renderPlan();
    expect(lastParams()).toMatchObject({ from: 'A', to: 'B' });
  });

  it('does not search on its own when the page opens empty', () => {
    renderPlan('/plan');
    expect(lastParams()).toEqual({});
  });

  it('does not search again while the departure time is being edited', () => {
    const { container } = renderPlan();
    const before = lastParams();
    const picker = container.querySelector('input[type="datetime-local"]');
    fireEvent.change(picker, { target: { value: '2026-11-07T15:11' } });
    fireEvent.change(picker, { target: { value: '2026-11-08T15:11' } });
    expect(lastParams()).toBe(before);
  });

  it('searches with the edited time once Search is pressed', () => {
    const { container } = renderPlan();
    const picker = container.querySelector('input[type="datetime-local"]');
    fireEvent.change(picker, { target: { value: '2026-11-08T15:11' } });
    fireEvent.click(screen.getByRole('button', { name: /search journeys/i }));
    // 15:11 in Berlin (CET, UTC+1) is 14:11 UTC.
    expect(lastParams()).toMatchObject({ from: 'A', to: 'B', departure: '2026-11-08T14:11:00.000Z' });
  });
});

import { formatTime, getDepartureStatus } from '../utils/transportUtils';
import '../css/StopoverTimeline.css';

function stopoverStatus(stopover) {
  const plannedTime = stopover.plannedDeparture ?? stopover.plannedArrival;
  const actualTime = stopover.departure ?? stopover.arrival;
  return getDepartureStatus(plannedTime, actualTime, stopover.cancelled);
}

function stopCoord(stopover) {
  const location = stopover.stop?.location;
  return location ? { lat: location.latitude, lon: location.longitude } : null;
}

// Where a non-cancelled stop sits relative to the vehicle's current
// position, driven entirely by the same `vehicle` object TripMap renders
// from — so the timeline and the map never disagree about what's current.
function nodeState(mode, currentIndex, index) {
  if (mode === 'done') return 'passed';
  if (mode === 'origin') return index === 0 ? 'current' : 'upcoming';
  if (currentIndex < 0) return 'upcoming';
  if (mode === 'at_stop') {
    if (index < currentIndex) return 'passed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  }
  if (mode === 'en_route') {
    return index <= currentIndex ? 'passed' : 'upcoming';
  }
  return 'upcoming';
}

/**
 * A vertical rail beside the map: one node per stop, arrival/departure
 * times, platform and delay. Passed stops dim, the segment currently being
 * travelled pulses amber, cancelled stops strike through. Clicking a stop
 * pans the map to it via onSelectStop.
 */
export default function StopoverTimeline({ stopovers, vehicle, onSelectStop }) {
  const list = stopovers || [];
  const nonCancelledNames = list.filter((s) => !s.cancelled).map((s) => s.stop?.name);

  let mode = null;
  let currentIndex = -1;
  if (vehicle?.status === 'scheduled') {
    mode = 'origin';
    currentIndex = 0;
  } else if (vehicle?.status === 'arrived') {
    mode = 'done';
    currentIndex = nonCancelledNames.length - 1;
  } else if (vehicle?.status === 'at_stop') {
    mode = 'at_stop';
    currentIndex = nonCancelledNames.indexOf(vehicle.stopName);
  } else if (vehicle?.status === 'en_route') {
    mode = 'en_route';
    currentIndex = nonCancelledNames.indexOf(vehicle.fromStop);
  }

  let seenIndex = -1;

  return (
    <ol className="stopover-timeline">
      {list.map((stopover, i) => {
        const cancelled = !!stopover.cancelled;
        const index = cancelled ? null : ++seenIndex;
        const state = cancelled ? 'cancelled' : nodeState(mode, currentIndex, index);
        const segmentActive = mode === 'en_route' && index === currentIndex;

        const status = stopoverStatus(stopover);
        const platform = stopover.platform ?? stopover.plannedPlatform;
        const platformChanged =
          stopover.plannedPlatform != null && stopover.platform != null && stopover.plannedPlatform !== stopover.platform;
        const coord = stopCoord(stopover);

        return (
          <li className={`stopover-node stopover-node-${state}`} key={stopover.stop?.id ?? i}>
            <div className="stopover-node-rail-col">
              <button
                type="button"
                className="stopover-node-marker"
                onClick={() => coord && onSelectStop?.(coord)}
                disabled={!coord}
                aria-label={`Pan map to ${stopover.stop?.name}`}
              />
              {i < list.length - 1 && (
                <div className={`stopover-rail${segmentActive ? ' stopover-rail-active' : ''}`} aria-hidden="true" />
              )}
            </div>
            <div className="stopover-node-body">
              <div className={`stopover-node-name${cancelled ? ' stopover-node-name-cancelled' : ''}`}>
                {stopover.stop?.name}
              </div>
              <div className="stopover-node-times">
                {(stopover.arrival || stopover.plannedArrival) && (
                  <span>{formatTime(stopover.arrival ?? stopover.plannedArrival)} arr</span>
                )}
                {(stopover.departure || stopover.plannedDeparture) && (
                  <span>{formatTime(stopover.departure ?? stopover.plannedDeparture)} dep</span>
                )}
              </div>
              <div className="stopover-node-meta">
                {platform && (
                  <span className={`stopover-platform${platformChanged ? ' stopover-platform-changed' : ''}`}>
                    Pl. {platform}
                  </span>
                )}
                {!cancelled && <span className={`stopover-status leg-status-${status.tone}`}>{status.text}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

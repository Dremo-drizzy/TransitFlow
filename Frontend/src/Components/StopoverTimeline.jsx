import { formatTime, getDepartureStatus } from '../utils/transportUtils';
import { nodeState, railActive } from '../utils/geo';
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

/**
 * A vertical rail beside the map: one node per stop, arrival/departure
 * times, platform and delay. Passed stops dim, the segment currently being
 * travelled pulses amber, cancelled stops strike through. Clicking a stop
 * pans the map to it via onSelectStop.
 */
export default function StopoverTimeline({ stopovers, vehicle, onSelectStop }) {
  const list = stopovers || [];

  return (
    <ol className="stopover-timeline">
      {list.map((stopover, i) => {
        const cancelled = !!stopover.cancelled;
        const state = cancelled ? 'cancelled' : nodeState(vehicle, i);
        const segmentActive = railActive(vehicle, i);

        const status = stopoverStatus(stopover);
        const platform = stopover.platform ?? stopover.plannedPlatform;
        const platformChanged =
          stopover.plannedPlatform != null && stopover.platform != null && stopover.plannedPlatform !== stopover.platform;
        const coord = stopCoord(stopover);

        // Position first: a loop line lists the same stop id many times.
        return (
          <li className={`stopover-node stopover-node-${state}`} key={`${i}-${stopover.stop?.id ?? ''}`}>
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

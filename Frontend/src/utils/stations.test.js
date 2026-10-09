import { describe, it, expect } from 'vitest';
import {
  isLegacyStopId,
  normalizeStationName,
  pickStation,
  nearestStation,
  legacyStations,
  applyResolutions,
  stripStatus,
} from './stations';
import { MAJOR_STATIONS } from '../data/majorStations';

describe('isLegacyStopId', () => {
  it.each(['8011160', '900003200', 8011160])('treats an all-digit id (%s) as the old data source', (id) => {
    expect(isLegacyStopId(id)).toBe(true);
  });

  it.each([
    'at-Railway-Current-Reference-Data-2026_de:11000:900003200:1:51',
    'de-VBB_de:11000:900003201:3:55',
    '',
    undefined,
    null,
  ])('does not treat %s as legacy', (id) => {
    expect(isLegacyStopId(id)).toBe(false);
  });
});

describe('normalizeStationName', () => {
  it('makes "Berlin Hbf" and "Berlin Hauptbahnhof" comparable — the case that actually happens', () => {
    expect(normalizeStationName('Berlin Hbf')).toBe(normalizeStationName('Berlin Hauptbahnhof'));
  });

  it('ignores a line-type prefix like "S+U"', () => {
    expect(normalizeStationName('S+U Berlin Hauptbahnhof')).toBe(normalizeStationName('Berlin Hbf'));
  });

  it('treats Bf and Bahnhof alike, and ignores case, accents and punctuation', () => {
    expect(normalizeStationName('Hannover Bahnhof')).toBe(normalizeStationName('hannover BF'));
    expect(normalizeStationName('Köln Hbf')).toBe(normalizeStationName('Koln Hauptbahnhof'));
    expect(normalizeStationName('Frankfurt (Main) Hbf')).toBe('frankfurt main hbf');
  });

  it('does not conflate different stations', () => {
    expect(normalizeStationName('Berlin Hbf')).not.toBe(normalizeStationName('Berlin Spandau'));
  });
});

describe('pickStation', () => {
  const station = (id, name, latitude, longitude) => ({
    id,
    name,
    type: 'station',
    location: { latitude, longitude },
  });
  const berlin = station('b', 'Berlin Hauptbahnhof', 52.525, 13.369);
  const berlinWest = station('bw', 'Berlin Zoologischer Garten', 52.507, 13.332);
  const poi = { id: 'node/1', name: 'Berlin', type: 'location', latitude: 43.4, longitude: -80.5 };

  it('prefers the name match over a different top result', () => {
    expect(pickStation([berlinWest, berlin], { name: 'Berlin Hbf' }).id).toBe('b');
  });

  it('without an exact match, takes the top station that at least resembles the name', () => {
    expect(pickStation([berlinWest, berlin], { name: 'Berlin Spandau' }).id).toBe('bw');
  });

  it('rejects a fuzzy result that has nothing to do with the name, instead of guessing', () => {
    // The real search answered a made-up station with "Nowhere Lane" in Britain.
    const nowhere = { id: 'gb-1', name: 'Nowhere Lane', type: 'station', location: { latitude: 52, longitude: -1 } };
    expect(pickStation([nowhere], { name: 'Qqzzxxv Nowherestadt' })).toBeNull();
    expect(pickStation([berlin, berlinWest], { name: 'Somewhere Else' })).toBeNull();
  });

  it('ignores points of interest', () => {
    expect(pickStation([poi, berlin], { name: 'Berlin Hbf' }).id).toBe('b');
    expect(pickStation([poi], { name: 'Berlin' })).toBeNull();
  });

  it('with several same-named stations, picks the one nearest the stored coordinates', () => {
    const near = station('n', 'Neustadt Hbf', 53.0, 10.0);
    const far = station('f', 'Neustadt Hbf', 48.0, 12.0);
    expect(pickStation([far, near], { name: 'Neustadt Hbf', coords: { lat: 53.01, lon: 10.01 } }).id).toBe('n');
  });

  it('with coordinates and no name match, falls back to the nearest candidate within 25 km', () => {
    const picked = pickStation([berlin, berlinWest], { name: 'Zoo', coords: { lat: 52.5075, lon: 13.3325 } });
    expect(picked.id).toBe('bw');
  });

  it('with coordinates, rejects a top result in another city instead of accepting it', () => {
    const hamburg = station('h', 'Hamburg Hbf', 53.553, 10.007);
    expect(pickStation([hamburg], { name: 'Berlin Hbf', coords: { lat: 52.525, lon: 13.369 } })).toBeNull();
  });

  it('returns null when there is nothing to pick from', () => {
    expect(pickStation([], { name: 'x' })).toBeNull();
    expect(pickStation(null, { name: 'x' })).toBeNull();
  });
});

describe('nearestStation', () => {
  it('finds the right major station for a point in the city', () => {
    const cologne = nearestStation(MAJOR_STATIONS, { lat: 50.9413, lon: 6.9583 }); // by the cathedral
    expect(cologne.station.name).toBe('Köln Hbf');
    expect(cologne.distanceM).toBeLessThan(1000);

    expect(nearestStation(MAJOR_STATIONS, { lat: 48.137, lon: 11.575 }).station.name).toBe('München Hbf');
    expect(nearestStation(MAJOR_STATIONS, { lat: 51.34, lon: 12.37 }).station.name).toBe('Leipzig Hbf');
  });

  it('reports the distance, which is what makes "nearest major station" honest', () => {
    // A village between Hamburg and Lübeck is a long way from either.
    const result = nearestStation(MAJOR_STATIONS, { lat: 53.75, lon: 10.4 });
    expect(['Hamburg Hbf', 'Lübeck Hbf']).toContain(result.station.name);
    expect(result.distanceM).toBeGreaterThan(15_000);
  });
});

describe('MAJOR_STATIONS data', () => {
  it('has about fifty stations with unique names, all inside Germany', () => {
    expect(MAJOR_STATIONS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(MAJOR_STATIONS.map((s) => s.name)).size).toBe(MAJOR_STATIONS.length);
    for (const s of MAJOR_STATIONS) {
      expect(s.latitude).toBeGreaterThan(47.2);
      expect(s.latitude).toBeLessThan(55.1);
      expect(s.longitude).toBeGreaterThan(5.8);
      expect(s.longitude).toBeLessThan(15.1);
    }
  });
});

describe('saved-commute migration', () => {
  const oldCommute = {
    id: 'c1',
    name: 'Home → Work',
    createdAt: '2026-01-01T00:00:00.000Z',
    from: { id: '8011160', name: 'Berlin Hbf', type: 'stop' },
    to: { id: '8000105', name: 'Frankfurt (Main) Hbf', type: 'stop' },
  };
  const newStation = (id, name) => ({
    id,
    name,
    type: 'station',
    location: { latitude: 1, longitude: 2 },
    extra: 'dropped',
  });
  const berlinNew = newStation('at-Railway_de:11000:900003200:1:51', 'Berlin Hauptbahnhof');

  it('finds each distinct legacy station once', () => {
    const second = { ...oldCommute, id: 'c2', to: { id: '8011160', name: 'Berlin Hbf' } };
    expect(legacyStations([oldCommute, second]).map((s) => s.id).sort()).toEqual(['8000105', '8011160']);
  });

  it('leaves a commute that already uses current ids alone and marks it ok', () => {
    const current = { ...oldCommute, from: berlinNew, to: berlinNew };
    const { commutes, persistable } = applyResolutions([current], {});
    expect(commutes[0].status).toBe('ok');
    expect(persistable).toBeNull();
  });

  it('marks a commute resolving while its lookups are in flight', () => {
    const { commutes, persistable } = applyResolutions([oldCommute], {
      8011160: { status: 'loading' },
      8000105: { status: 'loading' },
    });
    expect(commutes[0].status).toBe('resolving');
    expect(persistable).toBeNull();
  });

  it('swaps resolved stations in, keeps only the fields the app reads, and offers it for saving', () => {
    const { commutes, persistable } = applyResolutions([oldCommute], {
      8011160: { status: 'ok', station: berlinNew },
      8000105: { status: 'ok', station: newStation('de-DELFI_de:06412:10:16:16', 'Frankfurt Hauptbahnhof') },
    });
    expect(commutes[0].status).toBe('ok');
    expect(commutes[0].from.id).toBe(berlinNew.id);
    expect(commutes[0].name).toBe('Home → Work'); // the user's own label is untouched
    expect(persistable[0].from).not.toHaveProperty('extra');
    expect(persistable[0]).not.toHaveProperty('status');
  });

  it('keeps an unresolvable commute visible, flagged, with its old data intact — never drops it', () => {
    const { commutes } = applyResolutions([oldCommute], {
      8011160: { status: 'ok', station: berlinNew },
      8000105: { status: 'error' },
    });
    expect(commutes).toHaveLength(1);
    expect(commutes[0].status).toBe('unresolved');
    expect(commutes[0].to.id).toBe('8000105');
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify([oldCommute]);
    applyResolutions([oldCommute], { 8011160: { status: 'ok', station: berlinNew }, 8000105: { status: 'error' } });
    expect(JSON.stringify([oldCommute])).toBe(snapshot);
  });

  it('stripStatus removes the display-only flag', () => {
    expect(stripStatus([{ id: 'x', status: 'ok' }])).toEqual([{ id: 'x' }]);
  });
});

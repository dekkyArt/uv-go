import { useCallback, useEffect, useRef, useState } from 'react';
import { requestPosition, yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';

/**
 * "Use my location": asks the browser for a position and hands the "Your location" place to
 * `onPlace`. A refusal or timeout sets `geoError` instead. Nothing is set after unmount.
 */
export function useGeolocate(onPlace: (p: Place) => void) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const mounted = useRef(false);
  const latestOnPlace = useRef(onPlace);

  useEffect(() => {
    latestOnPlace.current = onPlace;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError(false);
    try {
      const { lat, lon } = await requestPosition();
      if (!mounted.current) return;
      latestOnPlace.current(yourLocationPlace(lat, lon));
    } catch {
      if (mounted.current) setGeoError(true);
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, []);

  const clearError = useCallback(() => setGeoError(false), []);

  return { locating, geoError, locate, clearError };
}

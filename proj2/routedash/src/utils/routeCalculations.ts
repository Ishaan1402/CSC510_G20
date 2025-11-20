import type { Coordinate } from "./polyline";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toRadians = (value: number) => (value * Math.PI) / 180;

/**
 * Calculates the distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export const distanceInMeters = (a: Coordinate, b: Coordinate): number => {
  const R = 6371e3; // Earth's radius in meters
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const c = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));

  return R * d;
};

/**
 * Picks a target coordinate along a route based on the preferred minute mark.
 * Returns the coordinate and the actual minute mark.
 */
export const pickTargetCoordinate = (
  coordinates: Coordinate[],
  durationSeconds: number,
  preferredMinuteMark: number,
): { coordinate: Coordinate; minuteMark: number } | null => {
  if (!coordinates.length) {
    return null;
  }

  const totalMinutes = durationSeconds > 0 ? durationSeconds / 60 : 0;
  const desiredMinutes = preferredMinuteMark > 0 ? preferredMinuteMark : 35;

  let ratio: number;

  if (!totalMinutes) {
    ratio = 0.5;
  } else {
    const rawRatio = desiredMinutes / totalMinutes;
    ratio = clamp(rawRatio, 0.05, 0.95);
  }

  const index = Math.min(Math.round(ratio * (coordinates.length - 1)), coordinates.length - 1);
  const coordinate = coordinates[index] ?? coordinates[coordinates.length - 1];
  const minuteMark = totalMinutes ? Math.round(totalMinutes * ratio) : Math.round(desiredMinutes);

  return {
    coordinate,
    minuteMark,
  };
};


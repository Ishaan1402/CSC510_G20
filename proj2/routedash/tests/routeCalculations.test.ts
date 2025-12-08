/// <reference types="vitest" />

/**
 * These tests verify the behavior of the routeCalculations utility, which
 * contains core math helpers used when planning and summarizing routes:
 *
 * - distanceInMeters: Haversine distance between two coordinates
 * - pickTargetCoordinate: chooses a "target" coordinate along a route
 *   based on a desired minute mark and total route duration.
 *
 * These functions are pure and do not depend on React Native,
 * so they are ideal for fast, isolated unit tests.
 */

import { describe, it, expect } from "vitest";
import { distanceInMeters, pickTargetCoordinate } from "../src/utils/routeCalculations";
import type { Coordinate } from "../src/utils/polyline";

// Helper to compare floating point numbers with a tolerance
const approxEqual = (a: number, b: number, tolerance = 1e-6) =>
  Math.abs(a - b) <= Math.abs(b) * tolerance;

describe("routeCalculations.distanceInMeters", () => {
  it("returns ~0 for identical coordinates", () => {
    const a: Coordinate = { latitude: 35.0, longitude: -78.0 };

    const d = distanceInMeters(a, a);

    // Distance between a point and itself should be extremely small
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(0.01); // less than 1 cm in meters
  });

  it("is symmetric with respect to input order", () => {
    const a: Coordinate = { latitude: 35.0, longitude: -78.0 };
    const b: Coordinate = { latitude: 36.0, longitude: -79.0 };

    const d1 = distanceInMeters(a, b);
    const d2 = distanceInMeters(b, a);

    // d(a, b) == d(b, a) up to floating point noise
    expect(approxEqual(d1, d2, 1e-9)).toBe(true);
  });
});

describe("routeCalculations.pickTargetCoordinate", () => {
  /**
   * Simple synthetic "route" with 4 coordinates laid out along longitude
   * 0, 1, 2, 3. This makes it easy to reason about which index is picked.
   */
  const coordinates: Coordinate[] = [
    { latitude: 0, longitude: 0 }, // index 0
    { latitude: 0, longitude: 1 }, // index 1
    { latitude: 0, longitude: 2 }, // index 2
    { latitude: 0, longitude: 3 }, // index 3
  ];

  it("returns null when the coordinates array is empty", () => {
    const result = pickTargetCoordinate([], 3600, 30); // 1 hour, 30-min mark

    expect(result).toBeNull();
  });

  it("defaults to midpoint when durationSeconds is 0", () => {
    /**
     * When durationSeconds is 0, totalMinutes becomes 0, so the function
     * takes the "no duration" path:
     *   - ratio = 0.5 (midpoint)
     *   - index = round(0.5 * (n - 1)) where n = 4 → round(0.5 * 3) = 2
     */
    const result = pickTargetCoordinate(coordinates, 0, 30);
    expect(result).not.toBeNull();
    if (!result) return; // TS narrowing

    expect(result.coordinate).toEqual(coordinates[2]);
    // With zero total minutes, minuteMark falls back to desiredMinutes.
    expect(result.minuteMark).toBe(30);
  });

  it("clamps ratio between 5% and 95% for very large preferred minute mark", () => {
    /**
     * When preferredMinuteMark is much larger than totalMinutes, the raw ratio
     * desiredMinutes / totalMinutes will be > 1.0, and the clamp should reduce
     * it to at most 0.95.
     *
     * For 60 minutes total (3600 seconds) and preferredMinuteMark = 1000:
     *   - totalMinutes = 60
     *   - desiredMinutes = 1000
     *   - rawRatio = 1000 / 60 ≈ 16.67
     *   - ratio = clamp(rawRatio, 0.05, 0.95) = 0.95
     *   - index = round(0.95 * (n - 1)) = round(0.95 * 3) ≈ 3
     */
    const totalSeconds = 60 * 60;
    const preferredMinuteMark = 1000;

    const result = pickTargetCoordinate(
      coordinates,
      totalSeconds,
      preferredMinuteMark,
    );

    expect(result).not.toBeNull();
    if (!result) return;

    // Should pick the last coordinate (index 3)
    const idx = coordinates.findIndex(
      (c) =>
        c.latitude === result.coordinate.latitude &&
        c.longitude === result.coordinate.longitude,
    );
    expect(idx).toBe(3);

    // The resulting minuteMark should still be within the route duration
    expect(result.minuteMark).toBeLessThanOrEqual(60);
    expect(result.minuteMark).toBeGreaterThan(0);
  });

  it("picks a mid-route coordinate when preferred minute is roughly halfway", () => {
    /**
     * For a 120-minute route and preferredMinuteMark = 60:
     *   - totalMinutes = 120
     *   - desiredMinutes = 60
     *   - rawRatio = 60 / 120 = 0.5 → within [0.05, 0.95], no clamping
     *   - index = round(0.5 * (n - 1)) = round(0.5 * 3) = 2
     */
    const totalSeconds = 120 * 60;
    const preferredMinuteMark = 60;

    const result = pickTargetCoordinate(
      coordinates,
      totalSeconds,
      preferredMinuteMark,
    );

    expect(result).not.toBeNull();
    if (!result) return;

    const idx = coordinates.findIndex(
      (c) =>
        c.latitude === result.coordinate.latitude &&
        c.longitude === result.coordinate.longitude,
    );

    // We expect index 2 for a 4-point route, but allow index 1 or 2
    // in case rounding changes slightly in the future.
    expect(idx === 1 || idx === 2).toBe(true);

    // Minute mark should be near the halfway point (around 60 minutes)
    expect(result.minuteMark).toBeGreaterThan(40);
    expect(result.minuteMark).toBeLessThan(80);
  });
});

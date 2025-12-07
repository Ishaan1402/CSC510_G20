/// <reference types="vitest" />

/**
 * These tests verify the behavior of the savedTripsStorage utility, which handles:
 * - Loading saved trips from AsyncStorage
 * - Saving new trips
 * - Deleting trips
 *
 * AsyncStorage is mocked so tests run deterministically without depending
 * on a device or emulator environment.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  loadSavedTrips,
  saveNewTrip,
  deleteSavedTrip,
} from "../src/utils/savedTripsStorage";

import type { SavedTrip } from "../src/types/savedTrip";

const SAVED_TRIPS_KEY = "saved_trips_v1";

/**
 * Mock AsyncStorage module before all tests.
 * We only override getItem and setItem, since those are the methods our utilities use.
 */
vi.mock("@react-native-async-storage/async-storage", () => {
  return {
    default: {
      getItem: vi.fn(),
      setItem: vi.fn(),
    },
  };
});

/**
 * Typed helper functions for the mocked AsyncStorage methods.
 * Using Mock from Vitest gives full type-safety for mockResolvedValue, mockReset, etc.
 */
const getItemMock = () => AsyncStorage.getItem as unknown as Mock;
const setItemMock = () => AsyncStorage.setItem as unknown as Mock;

describe("savedTripsStorage", () => {
  /**
   * Before each test, reset mock call history so tests do not leak data.
   */
  beforeEach(() => {
    getItemMock().mockReset();
    setItemMock().mockReset();
  });

  // -------------------------------------------------------------------------
  // 1. Loading trips
  // -------------------------------------------------------------------------

  it("loadSavedTrips returns [] when nothing stored", async () => {
    // Simulate no saved data
    getItemMock().mockResolvedValue(null);

    const trips = await loadSavedTrips();

    expect(getItemMock()).toHaveBeenCalledWith(SAVED_TRIPS_KEY);
    expect(trips).toEqual([]);
  });

  it("loadSavedTrips returns parsed array when valid JSON array is stored", async () => {
    // A well-formed saved trips array
    const mockTrips: SavedTrip[] = [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        origin: "A",
        destination: "B",
        stopType: "food",
        stopWindowMinutes: 30,
        filters: {
          fastService: false,
          vegetarian: false,
          vegan: false,
          localFavorites: false,
          priceLevel: null,
        },
        routeSnapshot: undefined,
        waypoints: [],
        restaurant: undefined,
        orderSummary: undefined,
      },
    ];

    // AsyncStorage returns the JSON string
    getItemMock().mockResolvedValue(JSON.stringify(mockTrips));

    const trips = await loadSavedTrips();

    // Should return the parsed array
    expect(trips).toEqual(mockTrips);
  });

  it("loadSavedTrips returns [] when stored JSON is not an array", async () => {
    // Simulate corrupted data: a JSON object, not array
    getItemMock().mockResolvedValue(JSON.stringify({ foo: "bar" }));

    const trips = await loadSavedTrips();

    // The function defends against bad formats and returns empty list
    expect(trips).toEqual([]);
  });

  it("loadSavedTrips returns [] when JSON.parse throws", async () => {
    // Silence console.warn for this test to avoid noisy test output
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Providing invalid JSON ensures JSON.parse() throws
    getItemMock().mockResolvedValue("not-json");

    const trips = await loadSavedTrips();

    // The function must catch the exception and return a safe fallback
    expect(trips).toEqual([]);

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 2. Saving trips
  // -------------------------------------------------------------------------

  it("saveNewTrip stores a new list when no trips exist", async () => {
    // Simulate first-time use: AsyncStorage contains no trips
    getItemMock().mockResolvedValue(null);

    const trip: SavedTrip = {
      id: "1",
      createdAt: new Date().toISOString(),
      origin: "Raleigh",
      destination: "Charlotte",
      stopType: "food",
      stopWindowMinutes: 45,
      filters: {
        fastService: false,
        vegetarian: false,
        vegan: false,
        localFavorites: false,
        priceLevel: null,
      },
      routeSnapshot: undefined,
      waypoints: [],
      restaurant: undefined,
      orderSummary: undefined,
    };

    await saveNewTrip(trip);

    // Should write a 1-element array containing the new trip
    expect(setItemMock()).toHaveBeenCalledWith(
      SAVED_TRIPS_KEY,
      JSON.stringify([trip]),
    );
  });

  it("saveNewTrip prepends the new trip to the existing list", async () => {
    const existing: SavedTrip[] = [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        origin: "A",
        destination: "B",
        stopType: "food",
        stopWindowMinutes: 30,
        filters: {
          fastService: false,
          vegetarian: false,
          vegan: false,
          localFavorites: false,
          priceLevel: null,
        },
        routeSnapshot: undefined,
        waypoints: [],
        restaurant: undefined,
        orderSummary: undefined,
      },
    ];

    // Return the existing list
    getItemMock().mockResolvedValue(JSON.stringify(existing));

    // New trip to prepend
    const newTrip: SavedTrip = {
      id: "2",
      createdAt: new Date().toISOString(),
      origin: "C",
      destination: "D",
      stopType: "food",
      stopWindowMinutes: 60,
      filters: {
        fastService: false,
        vegetarian: false,
        vegan: false,
        localFavorites: false,
        priceLevel: null,
      },
      routeSnapshot: undefined,
      waypoints: [],
      restaurant: undefined,
      orderSummary: undefined,
    };

    await saveNewTrip(newTrip);

    // Expect newTrip first, followed by existing trips
    expect(setItemMock()).toHaveBeenCalledWith(
      SAVED_TRIPS_KEY,
      JSON.stringify([newTrip, ...existing]),
    );
  });

  // -------------------------------------------------------------------------
  // 3. Deleting trips
  // -------------------------------------------------------------------------

  it("deleteSavedTrip removes the trip with matching id", async () => {
    // Two saved trips
    const existing: SavedTrip[] = [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        origin: "A",
        destination: "B",
        stopType: "food",
        stopWindowMinutes: 30,
        filters: {
          fastService: false,
          vegetarian: false,
          vegan: false,
          localFavorites: false,
          priceLevel: null,
        },
        routeSnapshot: undefined,
        waypoints: [],
        restaurant: undefined,
        orderSummary: undefined,
      },
      {
        id: "2",
        createdAt: new Date().toISOString(),
        origin: "C",
        destination: "D",
        stopType: "food",
        stopWindowMinutes: 45,
        filters: {
          fastService: false,
          vegetarian: false,
          vegan: false,
          localFavorites: false,
          priceLevel: null,
        },
        routeSnapshot: undefined,
        waypoints: [],
        restaurant: undefined,
        orderSummary: undefined,
      },
    ];

    // AsyncStorage returns them
    getItemMock().mockResolvedValue(JSON.stringify(existing));

    // Delete the first trip
    await deleteSavedTrip("1");

    // Only the second trip should remain
    expect(setItemMock()).toHaveBeenCalledWith(
      SAVED_TRIPS_KEY,
      JSON.stringify([existing[1]]),
    );
  });

  it("deleteSavedTrip with no stored trips writes an empty array", async () => {
    // No data in storage
    getItemMock().mockResolvedValue(null);

    await deleteSavedTrip("whatever");

    // It should simply write an empty array instead of throwing
    expect(setItemMock()).toHaveBeenCalledWith(
      SAVED_TRIPS_KEY,
      JSON.stringify([]),
    );
  });

  // -------------------------------------------------------------------------
  // 4. Extra edge cases for offline robustness
  // -------------------------------------------------------------------------

  it("loadSavedTrips returns [] when AsyncStorage.getItem rejects", async () => {
    // Simulate a low-level storage failure (e.g., disk error)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    getItemMock().mockRejectedValue(new Error("storage unavailable"));

    const trips = await loadSavedTrips();

    // Even if storage layer fails, we should fail gracefully with []
    expect(trips).toEqual([]);

    warnSpy.mockRestore();
  });

  it("deleteSavedTrip keeps the list unchanged when the id does not exist", async () => {
    const existing: SavedTrip[] = [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        origin: "A",
        destination: "B",
        stopType: "food",
        stopWindowMinutes: 30,
        filters: {
          fastService: false,
          vegetarian: false,
          vegan: false,
          localFavorites: false,
          priceLevel: null,
        },
        routeSnapshot: undefined,
        waypoints: [],
        restaurant: undefined,
        orderSummary: undefined,
      },
    ];

    getItemMock().mockResolvedValue(JSON.stringify(existing));

    // Try deleting an id that does not exist
    await deleteSavedTrip("non-existent-id");

    // We expect the same list to be saved back (no deletions)
    expect(setItemMock()).toHaveBeenCalledWith(
      SAVED_TRIPS_KEY,
      JSON.stringify(existing),
    );
  });
});

// src/utils/savedTripsStorage.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedTrip } from "../types/savedTrip";

const SAVED_TRIPS_KEY = "saved_trips_v1";

export const loadSavedTrips = async (): Promise<SavedTrip[]> => {
  try {
    const json = await AsyncStorage.getItem(SAVED_TRIPS_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedTrip[];
  } catch (e) {
    console.warn("loadSavedTrips failed", e);
    return [];
  }
};

export const saveNewTrip = async (trip: SavedTrip): Promise<void> => {
  const current = await loadSavedTrips();
  const next = [trip, ...current];
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));
};

export const deleteSavedTrip = async (id: string): Promise<void> => {
  const current = await loadSavedTrips();
  const next = current.filter((t) => t.id !== id);
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));
};

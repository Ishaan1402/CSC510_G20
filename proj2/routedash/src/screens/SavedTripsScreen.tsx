// src/screens/SavedTripsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { LogoutButton } from "../components/LogoutButton";
import { loadSavedTrips, deleteSavedTrip } from "../utils/savedTripsStorage";
import type { SavedTrip, SavedTripWaypoint } from "../types/savedTrip";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "SavedTrips">;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getWaypointIconAndLabel = (wp: SavedTripWaypoint): { icon: string; label: string } => {
  switch (wp.kind) {
    case "restaurant":
      return { icon: "🍽️", label: "Restaurant" };
    case "gas":
      return { icon: "⛽", label: "Gas station" };
    case "ev":
      return { icon: "🔌", label: "EV station" };
    default:
      return { icon: "📍", label: "Stop" };
  }
};

export const SavedTripsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTrips = async () => {
    setIsLoading(true);
    try {
      const loaded = await loadSavedTrips();
      setTrips(loaded);
    } catch (e) {
      console.warn("Failed to load saved trips", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshTrips();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // reload when screen gets focus
      void refreshTrips();
    }, []),
  );

  const handleUseTrip = (trip: SavedTrip) => {
    navigation.navigate("Planner", {
      fromSavedTrip: true,
      savedTrip: trip,
    });
  };

  const handleDeleteTrip = (trip: SavedTrip) => {
    Alert.alert(
      "Delete saved trip?",
      `Remove the trip from ${trip.origin} to ${trip.destination}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSavedTrip(trip.id);
              await refreshTrips();
            } catch (e) {
              console.warn("Failed to delete saved trip", e);
              Alert.alert("Oops", "We couldn't delete this trip right now. Try again shortly.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandBadge}>RouteDash</Text>
            <Text style={styles.headerTitle}>Saved Trips</Text>
            <Text style={styles.headerSubtitle}>
              Reuse your favorite routes, even when you're offline.
            </Text>
          </View>
          <LogoutButton />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your saved trips…</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No saved trips yet</Text>
          <Text style={styles.emptySubtitle}>
            Plan a route in the Trip Planner, then tap “Save trip for later” to see it here.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Planner")}
          >
            <Text style={styles.primaryButtonText}>Plan a new trip</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {trips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripRouteText} numberOfLines={1}>
                    {trip.origin} → {trip.destination}
                  </Text>
                  <Text style={styles.tripMetaText}>
                    Saved {formatDate(trip.createdAt)}
                  </Text>
                  {trip.routeSnapshot ? (
                    <Text style={styles.tripMetaText}>
                      {trip.routeSnapshot.durationText} • {trip.routeSnapshot.distanceText}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{trip.stopType.toUpperCase()}</Text>
                </View>
              </View>

              {trip.restaurant ? (
                <View style={styles.restaurantRow}>
                  <Text style={styles.restaurantLabel}>Primary restaurant:</Text>
                  <Text style={styles.restaurantName}>{trip.restaurant.name}</Text>
                  <Text style={styles.restaurantAddress}>{trip.restaurant.address}</Text>
                </View>
              ) : null}

              {trip.waypoints && trip.waypoints.length > 0 ? (
                <View style={styles.stopsSection}>
                  <Text style={styles.stopsTitle}>Stops on this route</Text>
                  {trip.waypoints.map((wp, index) => {
                    const { icon, label } = getWaypointIconAndLabel(wp);
                    return (
                      <View key={`${trip.id}-wp-${index}`} style={styles.stopRow}>
                        <View style={styles.stopIconCircle}>
                          <Text style={styles.stopIconText}>{icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stopLabel}>
                            Stop {index + 1} · {label}
                          </Text>
                          <Text style={styles.stopAddress} numberOfLines={2}>
                            {wp.address ??
                              `${wp.latitude.toFixed(3)}, ${wp.longitude.toFixed(3)}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.cardActionsRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => handleUseTrip(trip)}
                >
                  <Text style={styles.secondaryButtonText}>Use this route</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTrip(trip)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// optional default export if you ever want `import SavedTripsScreen from ...`
export default SavedTripsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandBadge: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#475569",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 16,
  },
  tripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  tripHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tripRouteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  tripMetaText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
  },
  restaurantRow: {
    marginTop: 8,
  },
  restaurantLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  restaurantAddress: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  stopsSection: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
  },
  stopsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 6,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
  },
  stopIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  stopIconText: {
    fontSize: 14,
  },
  stopLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
  },
  stopAddress: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
});

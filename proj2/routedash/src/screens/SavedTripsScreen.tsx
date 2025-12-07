// src/screens/SavedTripsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/types";
import type { SavedTrip } from "../types/savedTrip";
import { loadSavedTrips, deleteSavedTrip } from "../utils/savedTripsStorage";

type Props = NativeStackScreenProps<RootStackParamList, "SavedTrips">;

const formatShortDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatStopType = (stopType: SavedTrip["stopType"]) => {
  switch (stopType) {
    case "food":
      return "FOOD";
    case "gas":
      return "GAS";
    case "ev":
      return "EV";
    case "mixed":
    default:
      return "MIXED";
  }
};

export const SavedTripsScreen: React.FC<Props> = ({ navigation }) => {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTrips = async () => {
    setIsLoading(true);
    const data = await loadSavedTrips();
    setTrips(data);
    setIsLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", refreshTrips);
    return unsubscribe;
  }, [navigation]);

  const handleUseRoute = (trip: SavedTrip) => {
    navigation.navigate("Planner", {
      fromSavedTrip: true,
      savedTrip: trip,
    });
  };

  const handleDeleteTrip = (tripId: string) => {
    Alert.alert("Delete trip", "Are you sure you want to delete this saved trip?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSavedTrip(tripId);
          refreshTrips();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Simple internal header (no Logout here) */}
        <View style={styles.headerBlock}>
          <Text style={styles.brandBadge}>RouteDash</Text>
          <Text style={styles.title}>Saved Trips</Text>
          <Text style={styles.subtitle}>
            Reuse your favorite routes, even when you&apos;re offline.
          </Text>
        </View>

        {isLoading ? (
          <Text style={styles.emptyText}>Loading your saved trips…</Text>
        ) : trips.length === 0 ? (
          <Text style={styles.emptyText}>
            You haven&apos;t saved any trips yet. Plan a route and tap &quot;Save trip for
            later&quot; to see it here.
          </Text>
        ) : (
          trips.map((trip) => {
            const primaryRestaurant = trip.restaurant;
            const stops = trip.waypoints ?? [];

            return (
              <View key={trip.id} style={styles.card}>
                {/* Origin / destination row */}
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={styles.routeText}
                    numberOfLines={1}
                  >{`${trip.origin} → ${trip.destination}`}</Text>
                  <View style={styles.stopTypePill}>
                    <Text style={styles.stopTypeText}>
                      {formatStopType(trip.stopType)}
                    </Text>
                  </View>
                </View>

                {/* Meta row: saved at + snapshot */}
                <Text style={styles.savedAtText}>
                  Saved {formatShortDateTime(trip.createdAt)}
                </Text>
                {trip.routeSnapshot ? (
                  <Text style={styles.metaText}>
                    {trip.routeSnapshot.durationText || "—"} ·{" "}
                    {trip.routeSnapshot.distanceText || "—"}
                  </Text>
                ) : null}

                {/* Primary restaurant (if any) */}
                {primaryRestaurant ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionLabel}>Primary restaurant:</Text>
                    <Text style={styles.sectionValue}>{primaryRestaurant.name}</Text>
                    <Text style={styles.sectionSubValue}>
                      {primaryRestaurant.address}
                    </Text>
                  </View>
                ) : null}

                {/* Stops list */}
                {stops.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionLabel}>Stops on this route</Text>
                    {stops.map((stop, index) => {
                      let icon = "•";
                      let label = "Stop";

                      if (stop.kind === "restaurant") {
                        icon = "🍽️";
                        label = "Restaurant";
                      } else if (stop.kind === "gas") {
                        icon = "⛽";
                        label = "Gas station";
                      } else if (stop.kind === "ev") {
                        icon = "🔌";
                        label = "EV station";
                      }

                      return (
                        <View key={`${trip.id}-stop-${index}`} style={styles.stopRow}>
                          <View style={styles.stopIconCircle}>
                            <Text style={styles.stopIconText}>{icon}</Text>
                          </View>
                          <View style={styles.stopTextBlock}>
                            <Text style={styles.stopTitle}>
                              {`Stop ${index + 1} · ${label}`}
                            </Text>
                            {stop.address ? (
                              <Text style={styles.stopAddress} numberOfLines={1}>
                                {stop.address}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.useButton}
                    onPress={() => handleUseRoute(trip)}
                  >
                    <Text style={styles.useButtonText}>Use this route</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteTrip(trip.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  headerBlock: {
    marginBottom: 16,
  },
  brandBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  emptyText: {
    marginTop: 24,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  routeText: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  stopTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },
  stopTypeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  savedAtText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  sectionBlock: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 2,
  },
  sectionValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  sectionSubValue: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  stopIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  stopIconText: {
    fontSize: 16,
  },
  stopTextBlock: {
    flex: 1,
  },
  stopTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  stopAddress: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  useButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
  },
  useButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
});

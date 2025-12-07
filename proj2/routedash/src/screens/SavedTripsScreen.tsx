// src/screens/SavedTripsScreen.tsx
import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/types";
import type { SavedTrip } from "../types/savedTrip";
import { deleteSavedTrip, loadSavedTrips } from "../utils/savedTripsStorage";

type Props = NativeStackScreenProps<RootStackParamList, "SavedTrips">;

export const SavedTripsScreen: React.FC<Props> = ({ navigation }) => {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    const items = await loadSavedTrips();
    setTrips(items);
    setIsLoading(false);
  };

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      void refresh();
    });
    return unsub;
  }, [navigation]);

  const handleOpenTrip = (trip: SavedTrip) => {
    navigation.navigate("Planner", {
      fromSavedTrip: true,
      savedTrip: trip,
    });
  };

  const handleDeleteTrip = (trip: SavedTrip) => {
    Alert.alert("Delete trip", "Remove this saved trip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSavedTrip(trip.id);
          await refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <Text style={styles.loadingText}>Loading saved trips…</Text>
      ) : trips.length === 0 ? (
        <Text style={styles.emptyText}>No saved trips yet.</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.tripCard}
              onPress={() => handleOpenTrip(item)}
            >
              <View style={styles.tripHeader}>
                <Text style={styles.tripTitle}>
                  {item.origin} → {item.destination}
                </Text>
                <Pressable
                  style={styles.deletePill}
                  onPress={() => handleDeleteTrip(item)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
              <Text style={styles.tripMeta}>{item.stopType.toUpperCase()}</Text>
              <Text style={styles.tripMeta}>
                Window: {item.stopWindowMinutes} min
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 16 },
  loadingText: { textAlign: "center", marginTop: 24, color: "#64748B" },
  emptyText: { textAlign: "center", marginTop: 24, color: "#64748B" },
  listContent: { paddingBottom: 32, gap: 12 },
  tripCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tripTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", flexShrink: 1 },
  tripMeta: { fontSize: 13, color: "#64748B", marginTop: 2 },
  deletePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  deleteText: { fontSize: 11, fontWeight: "600", color: "#DC2626" },
});

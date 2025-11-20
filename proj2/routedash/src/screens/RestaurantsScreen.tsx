import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { apiFetch } from "../api/client";
import { TravelerFilters, type TravelerFiltersType } from "../components/TravelerFilters";
import { RestaurantSummary, RootStackParamList } from "../navigation/types";

type RestaurantsScreenProps = NativeStackScreenProps<RootStackParamList, "Restaurants">;

export const RestaurantsScreen = ({ navigation, route }: RestaurantsScreenProps) => {
  const { trip } = route.params;
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TravelerFiltersType>({
    fastService: false,
    vegetarian: false,
    vegan: false,
    localFavorites: false,
    priceLevel: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null); // Clear previous errors

        const queryParams = new URLSearchParams();
        if (filters.fastService) {
          queryParams.append("fastService", "true");
        }
        if (filters.vegan) {
          queryParams.append("dietaryNeeds", "vegan");
        } else if (filters.vegetarian) {
          queryParams.append("dietaryNeeds", "vegetarian");
        }
        if (filters.localFavorites) {
          queryParams.append("localFavorites", "true");
        }
        if (filters.priceLevel) {
          queryParams.append("priceLevel", filters.priceLevel);
        }

        const queryString = queryParams.toString();
        const url = `/api/restaurants${queryString ? `?${queryString}` : ""}`;
        
        try {
          const response = await apiFetch<{ restaurants: RestaurantSummary[] }>(url, {
            requireAuth: false,
          });
          // Ensure we have a valid response with restaurants array
          setRestaurants(Array.isArray(response?.restaurants) ? response.restaurants : []);
        } catch (fetchError) {
          // Handle API fetch errors gracefully
          const errorMessage = fetchError instanceof Error ? fetchError.message : "Failed to load restaurants";
          console.warn("Error fetching restaurants:", fetchError);
          setError(errorMessage);
          setRestaurants([]); // Set empty array on error
        }
      } catch (err) {
        // Catch any unexpected errors
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        console.error("Unexpected error in load:", err);
        setError(errorMessage);
        setRestaurants([]);
      } finally {
        setIsLoading(false);
      }
    };

    load().catch((err) => {
      // Final catch for any unhandled promise rejections
      console.error("Unhandled error in load promise:", err);
      setError("Failed to load restaurants. Please try again.");
      setRestaurants([]);
      setIsLoading(false);
    });
  }, [filters]);

  const handleOpen = (restaurant: RestaurantSummary) => {
    navigation.navigate("Menu", { restaurant, trip });
  };

  const handleRetry = () => {
    setError(null);
    // Trigger reload by updating filters (which will trigger useEffect)
    setFilters({ ...filters });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Registered Restaurants</Text>
      <TravelerFilters filters={filters} onFiltersChange={setFilters} />
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {isLoading ? (
        <ActivityIndicator color="#2563EB" style={styles.loader} />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => handleOpen(item)}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.address}</Text>
              <Text style={styles.eta}>ETA goal: {trip.pickupEtaMin} min</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {error ? "No restaurants found. Try adjusting your filters." : "No restaurants registered yet."}
            </Text>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 16 },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  listContent: { paddingBottom: 32 },
  loader: { marginTop: 20 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  name: { fontSize: 18, fontWeight: "700" },
  meta: { color: "#475569", marginTop: 4 },
  eta: { color: "#2563EB", marginTop: 6, fontWeight: "600" },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  error: { color: "#B91C1C", fontSize: 14, marginBottom: 8 },
  retryButton: {
    backgroundColor: "#DC2626",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    marginTop: 20,
    fontSize: 14,
  },
});

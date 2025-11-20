import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type TravelerFiltersType = {
  fastService: boolean;
  vegetarian: boolean;
  vegan: boolean;
  localFavorites: boolean;
  priceLevel: "BUDGET" | "MID" | "UPSCALE" | null;
};

type TravelerFiltersProps = {
  filters: TravelerFiltersType;
  onFiltersChange: (filters: TravelerFiltersType) => void;
};

export const TravelerFilters = ({ filters, onFiltersChange }: TravelerFiltersProps) => {
  const toggleFastService = () => {
    onFiltersChange({ ...filters, fastService: !filters.fastService });
  };

  const toggleVegetarian = () => {
    onFiltersChange({ ...filters, vegetarian: !filters.vegetarian });
  };

  const toggleVegan = () => {
    onFiltersChange({ ...filters, vegan: !filters.vegan });
  };

  const toggleLocalFavorites = () => {
    onFiltersChange({ ...filters, localFavorites: !filters.localFavorites });
  };

  const setPriceLevel = (level: "BUDGET" | "MID" | "UPSCALE" | null) => {
    onFiltersChange({ ...filters, priceLevel: level });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Fast Service</Text>
      <Pressable
        style={[styles.toggleButton, filters.fastService && styles.toggleButtonActive]}
        onPress={toggleFastService}
      >
        <Text
          style={[styles.toggleButtonText, filters.fastService && styles.toggleButtonTextActive]}
        >
          Fast Service
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Dietary Needs</Text>
      <View style={styles.buttonGroup}>
        <Pressable
          style={[styles.button, filters.vegetarian && styles.buttonActive]}
          onPress={toggleVegetarian}
        >
          <Text
            style={[styles.buttonText, filters.vegetarian && styles.buttonTextActive]}
          >
            Vegetarian
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, filters.vegan && styles.buttonActive]}
          onPress={toggleVegan}
        >
          <Text style={[styles.buttonText, filters.vegan && styles.buttonTextActive]}>Vegan</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Local Favorites</Text>
      <Pressable
        style={[styles.toggleButton, filters.localFavorites && styles.toggleButtonActive]}
        onPress={toggleLocalFavorites}
      >
        <Text
          style={[
            styles.toggleButtonText,
            filters.localFavorites && styles.toggleButtonTextActive,
          ]}
        >
          Local Favorites
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Price Range</Text>
      <View style={styles.buttonGroup}>
        <Pressable
          style={[styles.button, filters.priceLevel === "BUDGET" && styles.buttonActive]}
          onPress={() => setPriceLevel(filters.priceLevel === "BUDGET" ? null : "BUDGET")}
        >
          <Text
            style={[styles.buttonText, filters.priceLevel === "BUDGET" && styles.buttonTextActive]}
          >
            Budget
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, filters.priceLevel === "MID" && styles.buttonActive]}
          onPress={() => setPriceLevel(filters.priceLevel === "MID" ? null : "MID")}
        >
          <Text style={[styles.buttonText, filters.priceLevel === "MID" && styles.buttonTextActive]}>
            Mid
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, filters.priceLevel === "UPSCALE" && styles.buttonActive]}
          onPress={() => setPriceLevel(filters.priceLevel === "UPSCALE" ? null : "UPSCALE")}
        >
          <Text
            style={[
              styles.buttonText,
              filters.priceLevel === "UPSCALE" && styles.buttonTextActive,
            ]}
          >
            Upscale
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 12,
    marginBottom: 8,
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#F8FAFC",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonActive: {
    borderColor: "#2563EB",
    backgroundColor: "#E0F2FE",
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  toggleButtonTextActive: {
    color: "#2563EB",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#F8FAFC",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    borderColor: "#2563EB",
    backgroundColor: "#E0F2FE",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  buttonTextActive: {
    color: "#2563EB",
  },
});


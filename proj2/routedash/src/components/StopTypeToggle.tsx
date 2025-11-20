import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type StopType = "restaurants" | "stations" | "both";

type StopTypeToggleProps = {
  value: StopType;
  onValueChange: (value: StopType) => void;
};

export const StopTypeToggle = ({ value, onValueChange }: StopTypeToggleProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Show stops</Text>
      <View style={styles.buttonGroup}>
        <Pressable
          style={[styles.button, value === "restaurants" && styles.buttonActive]}
          onPress={() => onValueChange("restaurants")}
        >
          <Text
            style={[styles.buttonText, value === "restaurants" && styles.buttonTextActive]}
          >
            Restaurants
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, value === "stations" && styles.buttonActive]}
          onPress={() => onValueChange("stations")}
        >
          <Text style={[styles.buttonText, value === "stations" && styles.buttonTextActive]}>
            Gas/EV
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, value === "both" && styles.buttonActive]}
          onPress={() => onValueChange("both")}
        >
          <Text style={[styles.buttonText, value === "both" && styles.buttonTextActive]}>
            Both
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#F8FAFC",
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    borderColor: "#2563EB",
    backgroundColor: "#E0F2FE",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  buttonTextActive: {
    color: "#2563EB",
  },
});


import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { VehicleType } from "../navigation/types";

type VehicleTypeSelectorProps = {
  value: VehicleType;
  onValueChange: (value: "GAS" | "EV") => void;
};

export const VehicleTypeSelector = ({ value, onValueChange }: VehicleTypeSelectorProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Vehicle type</Text>
      <View style={styles.buttonGroup}>
        <Pressable
          style={[styles.button, value === "GAS" && styles.buttonActive]}
          onPress={() => onValueChange("GAS")}
        >
          <Text style={[styles.buttonText, value === "GAS" && styles.buttonTextActive]}>
            Gas
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, value === "EV" && styles.buttonActive]}
          onPress={() => onValueChange("EV")}
        >
          <Text style={[styles.buttonText, value === "EV" && styles.buttonTextActive]}>EV</Text>
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


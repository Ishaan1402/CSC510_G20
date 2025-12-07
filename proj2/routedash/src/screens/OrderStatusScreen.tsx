// src/screens/OrderStatusScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type OrderStatusScreenProps = NativeStackScreenProps<RootStackParamList, "OrderStatus">;

export const OrderStatusScreen: React.FC<OrderStatusScreenProps> = ({ route, navigation }) => {
  const { orderId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Status</Text>
      <Text style={styles.subtitle}>Order ID: {orderId}</Text>
      {/* whatever else you render */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F1F5F9",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
});

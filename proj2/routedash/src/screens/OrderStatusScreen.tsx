// src/screens/OrderStatusScreen.tsx
import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, OrderStatusValue } from "../navigation/types";

type OrderStatusScreenProps = NativeStackScreenProps<RootStackParamList, "OrderStatus">;

const STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING: "Pending",
  PREPARING: "Processing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

const STATUS_COLORS: Record<OrderStatusValue, string> = {
  PENDING: "#DBEAFE",
  PREPARING: "#FDE68A",
  READY: "#BBF7D0",
  COMPLETED: "#DCFCE7",
  CANCELED: "#FEE2E2",
};

export const OrderStatusScreen: React.FC<OrderStatusScreenProps> = ({ route }) => {
  const { order } = route.params;

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Order not found</Text>
      </View>
    );
  }

  const createdLabel = order.createdAt ? new Date(order.createdAt).toLocaleString() : undefined;
  const statusColor = STATUS_COLORS[order.status] || "#E2E8F0";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Order Details</Text>
          <View style={[styles.statusChip, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant</Text>
          <Text style={styles.infoText}>{order.restaurant.name}</Text>
          <Text style={styles.metaText}>{order.restaurant.address}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <Text style={styles.infoText}>
            {order.routeOrigin} → {order.routeDestination}
          </Text>
          <Text style={styles.metaText}>Pickup ETA: {order.pickupEtaMin} minutes</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>
                  {item.quantity} × {item.name || item.menuItem?.name || "Item"}
                </Text>
              </View>
              <Text style={styles.itemPrice}>${((item.priceCents * item.quantity) / 100).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${(order.totalCents / 100).toFixed(2)}</Text>
          </View>
        </View>

        {createdLabel && (
          <>
            <View style={styles.divider} />
            <Text style={styles.metaText}>Placed: {createdLabel}</Text>
          </>
        )}

        <View style={styles.divider} />
        <Text style={styles.orderId}>Order ID: {order.id.slice(0, 8).toUpperCase()}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: "600",
    color: "#0F172A",
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "600",
  },
  metaText: {
    fontSize: 13,
    color: "#64748B",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: "#1E293B",
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },
  orderId: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "monospace",
  },
  error: {
    color: "#B91C1C",
    fontSize: 16,
    textAlign: "center",
    marginTop: 24,
  },
});

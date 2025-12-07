// src/screens/OrderStatusScreen.tsx
import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiPatch } from "../api/client";
import { useDirections } from "../hooks/useDirections";
import type { RootStackParamList, OrderStatusValue, OrderSummary } from "../navigation/types";

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
  const { order: initialOrder } = route.params;
  const [order, setOrder] = useState<OrderSummary & { createdAt?: string }>(initialOrder);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState(order.routeOrigin);
  const [routeDestination, setRouteDestination] = useState(order.routeDestination);
  const { fetchRoute, result: directionsResult, isLoading: isCalculatingRoute } = useDirections();

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Order not found</Text>
      </View>
    );
  }

  const canUpdateRoute = order.status === "PENDING" || order.status === "PREPARING";
  const createdLabel = order.createdAt ? new Date(order.createdAt).toLocaleString() : undefined;
  const statusColor = STATUS_COLORS[order.status] || "#E2E8F0";

  const handleCalculateETA = async () => {
    if (!routeOrigin.trim() || !routeDestination.trim()) {
      Alert.alert("Error", "Please enter both origin and destination");
      return;
    }

    const success = await fetchRoute(routeOrigin.trim(), routeDestination.trim());
    if (!success) {
      Alert.alert("Error", "Failed to calculate route. Please check your addresses.");
    }
  };

  const handleUpdateRoute = async () => {
    if (!routeOrigin.trim() || !routeDestination.trim()) {
      Alert.alert("Error", "Please enter both origin and destination");
      return;
    }

    // If we have a directions result, use its duration; otherwise use the existing ETA
    let newEtaMin = order.pickupEtaMin;
    if (directionsResult?.leg?.durationSeconds) {
      newEtaMin = Math.round(directionsResult.leg.durationSeconds / 60);
    }

    setIsUpdating(true);
    try {
      const response = await apiPatch<{ order: OrderSummary }>(`/api/orders/${order.id}/route`, {
        routeOrigin: routeOrigin.trim(),
        routeDestination: routeDestination.trim(),
        pickupEtaMin: newEtaMin,
      });

      setOrder(response.order);
      setIsEditingRoute(false);
      Alert.alert("Success", "Route updated successfully");
    } catch (error) {
      Alert.alert("Error", (error as Error).message || "Failed to update route");
    } finally {
      setIsUpdating(false);
    }
  };

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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Route</Text>
            {canUpdateRoute && !isEditingRoute && (
              <Pressable onPress={() => setIsEditingRoute(true)} style={styles.editButton}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            )}
          </View>
          {isEditingRoute ? (
            <View style={styles.routeEditContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Origin</Text>
                <TextInput
                  style={styles.input}
                  value={routeOrigin}
                  onChangeText={setRouteOrigin}
                  placeholder="Enter origin address"
                  editable={!isUpdating}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Destination</Text>
                <TextInput
                  style={styles.input}
                  value={routeDestination}
                  onChangeText={setRouteDestination}
                  placeholder="Enter destination address"
                  editable={!isUpdating}
                />
              </View>
              <Pressable
                onPress={handleCalculateETA}
                style={[styles.calculateButton, isCalculatingRoute && styles.buttonDisabled]}
                disabled={isCalculatingRoute || isUpdating}
              >
                {isCalculatingRoute ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.calculateButtonText}>Calculate ETA</Text>
                )}
              </Pressable>
              {directionsResult && (
                <Text style={styles.etaPreview}>
                  New ETA: ~{Math.round(directionsResult.leg.durationSeconds / 60)} minutes
                </Text>
              )}
              <View style={styles.routeEditActions}>
                <Pressable
                  onPress={() => {
                    setIsEditingRoute(false);
                    setRouteOrigin(order.routeOrigin);
                    setRouteDestination(order.routeDestination);
                  }}
                  style={[styles.cancelButton, isUpdating && styles.buttonDisabled]}
                  disabled={isUpdating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleUpdateRoute}
                  style={[styles.updateButton, isUpdating && styles.buttonDisabled]}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.updateButtonText}>Update Route</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.infoText}>
                {order.routeOrigin} → {order.routeDestination}
              </Text>
              <Text style={styles.metaText}>Pickup ETA: {order.pickupEtaMin} minutes</Text>
            </>
          )}
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  editButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  editButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  routeEditContainer: {
    gap: 12,
    marginTop: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#FFF",
    color: "#1E293B",
  },
  calculateButton: {
    backgroundColor: "#64748B",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  calculateButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  etaPreview: {
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "600",
    textAlign: "center",
  },
  routeEditActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  cancelButtonText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
  },
  updateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  updateButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

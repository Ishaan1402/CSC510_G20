import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiDelete, apiFetch, apiPatch, apiPost } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { MenuSection, OrderStatusValue } from "../navigation/types";

type RestaurantOrderItem = {
  id: string;
  menuItemId: string;
  quantity: number;
  priceCents: number;
  menuItem: { name: string };
};

type RestaurantOrder = {
  id: string;
  status: OrderStatusValue;
  pickupEtaMin: number;
  routeOrigin: string;
  routeDestination: string;
  totalCents: number;
  createdAt: string;
  customer: { id: string; name: string };
  items: RestaurantOrderItem[];
};

const STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING: "Pending",
  PREPARING: "Processing",
  READY: "Ready",
  COMPLETED: "Done",
  CANCELED: "Canceled",
};

const ORDER_ACTIONS: Partial<
  Record<
    OrderStatusValue,
    Array<{
      label: string;
      target: OrderStatusValue;
      tone?: "primary" | "danger";
    }>
  >
> = {
  PENDING: [
    { label: "Start Processing", target: "PREPARING", tone: "primary" },
    { label: "Cancel Order", target: "CANCELED", tone: "danger" },
  ],
  PREPARING: [
    { label: "Mark Ready", target: "READY", tone: "primary" },
    { label: "Cancel Order", target: "CANCELED", tone: "danger" },
  ],
  READY: [
    { label: "Mark Done", target: "COMPLETED", tone: "primary" },
    { label: "Cancel Order", target: "CANCELED", tone: "danger" },
  ],
};

type PopularItem = {
  menuItemId: string;
  name: string;
  totalQuantity: number;
  totalRevenueCents: number;
};

type TimeBasedStats = {
  date: string;
  orderCount: number;
  totalRevenueCents: number;
  averageOrderValueCents: number;
};

type RestaurantAnalytics = {
  popularItems: PopularItem[];
  averageOrderCostCents: number;
  totalOrders: number;
  totalRevenueCents: number;
  ordersByDay: TimeBasedStats[];
  ordersByWeek: TimeBasedStats[];
  peakOrderingHours: Array<{ hour: number; orderCount: number }>;
};

export const MerchantDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "analytics">("orders");
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [analytics, setAnalytics] = useState<RestaurantAnalytics | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("10.00");
  const [itemSectionId, setItemSectionId] = useState<string | undefined>(undefined);

  const restaurantId = user?.restaurantId;

  const loadMenu = useCallback(async () => {
    if (!restaurantId) {
      return;
    }
    try {
      setMenuError(null);
      setIsMenuLoading(true);
      const response = await apiFetch<{ sections: MenuSection[] }>(
        `/api/restaurants/${restaurantId}/menu`,
      );
      setSections(response.sections);
      if (response.sections.length) {
        setItemSectionId(response.sections[0].id);
      }
    } catch (err) {
      setMenuError((err as Error).message);
    } finally {
      setIsMenuLoading(false);
    }
  }, [restaurantId]);

  const loadOrders = useCallback(async () => {
    if (!restaurantId) {
      return;
    }
    try {
      setOrdersError(null);
      setIsOrdersLoading(true);
      const response = await apiFetch<{ orders: RestaurantOrder[] }>(
        `/api/restaurants/${restaurantId}/orders`,
      );
      setOrders(response.orders);
    } catch (err) {
      setOrdersError((err as Error).message);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [restaurantId]);

  const loadAnalytics = useCallback(async () => {
    if (!restaurantId) {
      return;
    }
    try {
      setAnalyticsError(null);
      setIsAnalyticsLoading(true);
      const response = await apiFetch<RestaurantAnalytics>(
        `/api/restaurants/${restaurantId}/analytics`,
      );
      setAnalytics(response);
    } catch (err) {
      setAnalyticsError((err as Error).message);
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }
    loadMenu().catch(() => {});
    loadOrders().catch(() => {});
  }, [loadMenu, loadOrders, restaurantId]);

  const handleAddSection = async () => {
    if (!restaurantId || !sectionTitle.trim()) {
      return;
    }
    try {
      setMenuError(null);
      await apiPost(`/api/restaurants/${restaurantId}/menu/sections`, {
        title: sectionTitle.trim(),
      });
      setSectionTitle("");
      await loadMenu();
    } catch (err) {
      setMenuError((err as Error).message);
    }
  };

  const handleAddItem = async () => {
    if (!restaurantId || !itemName.trim()) {
      return;
    }
    try {
      setMenuError(null);
      await apiPost(`/api/restaurants/${restaurantId}/menu/items`, {
        sectionId: itemSectionId ?? null,
        name: itemName.trim(),
        priceCents: Math.round(parseFloat(itemPrice) * 100),
      });
      setItemName("");
      await loadMenu();
    } catch (err) {
      setMenuError((err as Error).message);
    }
  };

  const toggleAvailability = async (itemId: string, isAvailable: boolean) => {
    if (!restaurantId) {
      return;
    }
    try {
      setMenuError(null);
      await apiPatch(`/api/restaurants/${restaurantId}/menu/items/${itemId}`, {
        isAvailable: !isAvailable,
      });
      await loadMenu();
    } catch (err) {
      setMenuError((err as Error).message);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!restaurantId) {
      return;
    }
    try {
      setMenuError(null);
      await apiDelete(`/api/restaurants/${restaurantId}/menu/items/${itemId}`);
      await loadMenu();
    } catch (err) {
      setMenuError((err as Error).message);
    }
  };

  const handleOrderStatusChange = async (orderId: string, nextStatus: OrderStatusValue) => {
    if (!restaurantId) {
      return;
    }
    try {
      setOrdersError(null);
      await apiPatch(`/api/restaurants/${restaurantId}/orders/${orderId}`, {
        status: nextStatus,
      });
      await loadOrders();
    } catch (err) {
      setOrdersError((err as Error).message);
    }
  };

  const switchTab = (tab: "orders" | "menu" | "analytics") => {
    setActiveTab(tab);
    if (tab === "orders") {
      loadOrders().catch(() => {});
    } else if (tab === "menu") {
      loadMenu().catch(() => {});
    } else if (tab === "analytics") {
      loadAnalytics().catch(() => {});
    }
  };

  if (!restaurantId) {
    return (
      <View style={styles.centered}>
        <Text>No restaurant linked to this account.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Merchant Dashboard</Text>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => switchTab("orders")}
          style={[styles.tabButton, activeTab === "orders" && styles.tabButtonActive]}
        >
          <Text
            style={[styles.tabButtonText, activeTab === "orders" && styles.tabButtonTextActive]}
          >
            Orders
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchTab("menu")}
          style={[styles.tabButton, activeTab === "menu" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabButtonText, activeTab === "menu" && styles.tabButtonTextActive]}>
            Menu
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchTab("analytics")}
          style={[styles.tabButton, activeTab === "analytics" && styles.tabButtonActive]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "analytics" && styles.tabButtonTextActive,
            ]}
          >
            Analytics
          </Text>
        </Pressable>
      </View>

      {activeTab === "orders" ? (
        <>
          {ordersError ? <Text style={styles.error}>{ordersError}</Text> : null}
          {isOrdersLoading ? <ActivityIndicator color="#2563EB" /> : null}
          {!isOrdersLoading && orders.length === 0 ? (
            <Text style={styles.meta}>No orders yet</Text>
          ) : null}
          {orders.map((order) => {
            const actions = ORDER_ACTIONS[order.status] ?? [];
            const createdLabel = new Date(order.createdAt).toLocaleString();
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderTitle}>Order #{order.id.slice(0, 6).toUpperCase()}</Text>
                  <View style={[styles.statusChip, styles[`statusChip${order.status}` as const]]}>
                    <Text style={styles.statusChipText}>{STATUS_LABELS[order.status]}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>Customer: {order.customer.name}</Text>
                <Text style={styles.meta}>Placed: {createdLabel}</Text>
                <Text style={styles.meta}>
                  Route: {order.routeOrigin} → {order.routeDestination}
                </Text>
                <Text style={styles.meta}>
                  ETA {order.pickupEtaMin} min • ${(order.totalCents / 100).toFixed(2)}
                </Text>
                <View style={styles.divider} />
                <View style={styles.orderItems}>
                  {order.items.map((item) => (
                    <Text key={item.id} style={styles.orderItemText}>
                      {item.quantity} × {item.menuItem?.name ?? "Item"}
                    </Text>
                  ))}
                </View>
                {actions.length ? (
                  <View style={styles.orderActions}>
                    {actions.map((action) => (
                      <Pressable
                        key={action.target}
                        style={[
                          styles.orderActionBtn,
                          action.tone === "danger"
                            ? styles.orderActionBtnDanger
                            : styles.orderActionBtnPrimary,
                        ]}
                        onPress={() => handleOrderStatusChange(order.id, action.target)}
                      >
                        <Text
                          style={[
                            styles.orderActionText,
                            action.tone === "danger"
                              ? styles.orderActionTextDanger
                              : styles.orderActionTextPrimary,
                          ]}
                        >
                          {action.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : activeTab === "analytics" ? (
        <>
          {analyticsError ? <Text style={styles.error}>{analyticsError}</Text> : null}
          {isAnalyticsLoading ? <ActivityIndicator color="#2563EB" /> : null}
          {!isAnalyticsLoading && analytics && (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Order Statistics</Text>
                <View style={styles.statRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{analytics.totalOrders}</Text>
                    <Text style={styles.statLabel}>Total Orders</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>
                      ${(analytics.totalRevenueCents / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>
                      ${(analytics.averageOrderCostCents / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.statLabel}>Avg Order Value</Text>
                  </View>
                </View>
              </View>

              {analytics.ordersByDay.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Orders by Day (Last 30 Days)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.timeStatsContainer}>
                      {analytics.ordersByDay.slice(-7).map((day) => (
                        <View key={day.date} style={styles.timeStatBox}>
                          <Text style={styles.timeStatDate}>
                            {new Date(day.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                          <Text style={styles.timeStatValue}>{day.orderCount}</Text>
                          <Text style={styles.timeStatLabel}>orders</Text>
                          <Text style={styles.timeStatRevenue}>
                            ${(day.totalRevenueCents / 100).toFixed(0)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {analytics.peakOrderingHours.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Peak Ordering Hours</Text>
                  {analytics.peakOrderingHours.map((hourData, index) => (
                    <View key={hourData.hour} style={styles.hourRow}>
                      <View style={styles.hourInfo}>
                        <Text style={styles.hourText}>
                          {hourData.hour === 0
                            ? "12 AM"
                            : hourData.hour < 12
                              ? `${hourData.hour} AM`
                              : hourData.hour === 12
                                ? "12 PM"
                                : `${hourData.hour - 12} PM`}
                        </Text>
                        <Text style={styles.meta}>{hourData.orderCount} orders</Text>
                      </View>
                      <View style={styles.hourBar}>
                        <View
                          style={[
                            styles.hourBarFill,
                            {
                              width: `${(hourData.orderCount / analytics.peakOrderingHours[0].orderCount) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Most Popular Items</Text>
                {analytics.popularItems.length === 0 ? (
                  <Text style={styles.meta}>No orders yet</Text>
                ) : (
                  analytics.popularItems.map((item, index) => (
                    <View key={item.menuItemId} style={styles.popularItemRow}>
                      <View style={styles.popularItemRank}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                      </View>
                      <View style={styles.popularItemInfo}>
                        <Text style={styles.popularItemName}>{item.name}</Text>
                        <Text style={styles.meta}>
                          {item.totalQuantity} ordered • ${(item.totalRevenueCents / 100).toFixed(2)} revenue
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </>
      ) : (
        <>
          {menuError ? <Text style={styles.error}>{menuError}</Text> : null}
          {isMenuLoading ? <ActivityIndicator color="#2563EB" /> : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add Menu Section</Text>
            <TextInput
              style={styles.input}
              placeholder="Section title (e.g., Breakfast)"
              value={sectionTitle}
              onChangeText={setSectionTitle}
            />
            <Pressable style={styles.primaryBtn} onPress={handleAddSection}>
              <Text style={styles.primaryBtnText}>Add Section</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add Menu Item</Text>
            <TextInput
              style={styles.input}
              placeholder="Item name"
              value={itemName}
              onChangeText={setItemName}
            />
            <TextInput
              style={styles.input}
              placeholder="Price (e.g., 9.99)"
              keyboardType="decimal-pad"
              value={itemPrice}
              onChangeText={setItemPrice}
            />
            <Text style={styles.label}>Section</Text>
            <FlatList
              data={sections}
              horizontal
              keyExtractor={(section) => section.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.pill, itemSectionId === item.id && styles.pillActive]}
                  onPress={() => setItemSectionId(item.id)}
                >
                  <Text style={itemSectionId === item.id ? styles.pillTextActive : styles.pillText}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.meta}>No sections yet</Text>}
            />
            <Pressable style={[styles.primaryBtn, styles.addItemBtn]} onPress={handleAddItem}>
              <Text style={styles.primaryBtnText}>Add Item</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Menu</Text>
            {sections.map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>{section.title}</Text>
                {section.items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.meta}>${(item.priceCents / 100).toFixed(2)}</Text>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        style={styles.secondaryBtn}
                        onPress={() => toggleAvailability(item.id, item.isAvailable)}
                      >
                        <Text style={styles.secondaryText}>
                          {item.isAvailable ? "Disable" : "Enable"}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.deleteBtn} onPress={() => removeItem(item.id)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#F8FAFC",
    flexGrow: 1,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { fontSize: 24, fontWeight: "700" },
  error: { color: "#B91C1C" },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#FFF",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tabButtonText: { fontWeight: "600", color: "#475569" },
  tabButtonTextActive: { color: "#0F172A" },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5F5",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  label: { fontWeight: "600", marginBottom: 6 },
  primaryBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  addItemBtn: {
    marginTop: 12,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "700" },
  logoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
  },
  logoutText: { fontWeight: "600", color: "#0F172A" },
  meta: { color: "#475569" },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderTitle: { fontSize: 18, fontWeight: "700" },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  statusChipPENDING: { backgroundColor: "#E0F2FE" },
  statusChipPREPARING: { backgroundColor: "#FDE68A" },
  statusChipREADY: { backgroundColor: "#BBF7D0" },
  statusChipCOMPLETED: { backgroundColor: "#DCFCE7" },
  statusChipCANCELED: { backgroundColor: "#FEE2E2" },
  statusChipText: { fontWeight: "600", color: "#0F172A" },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },
  orderItems: { gap: 4 },
  orderItemText: { color: "#1F2937" },
  orderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  orderActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  orderActionBtnPrimary: { backgroundColor: "#2563EB" },
  orderActionBtnDanger: { backgroundColor: "#FEE2E2" },
  orderActionText: { fontWeight: "600" },
  orderActionTextPrimary: { color: "#FFF" },
  orderActionTextDanger: { color: "#B91C1C" },
  pill: {
    borderWidth: 1,
    borderColor: "#CBD5F5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  pillActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  pillText: { color: "#0F172A" },
  pillTextActive: { color: "#FFF" },
  sectionBlock: { marginBottom: 12 },
  sectionHeading: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemName: { fontWeight: "600" },
  itemActions: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
  },
  secondaryText: { color: "#0369A1", fontWeight: "600" },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  deleteText: { color: "#B91C1C", fontWeight: "600" },
  statRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  popularItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  popularItemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankNumber: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  popularItemInfo: {
    flex: 1,
  },
  popularItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 4,
  },
  timeStatsContainer: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  timeStatBox: {
    minWidth: 80,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  timeStatDate: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 4,
  },
  timeStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  timeStatLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  timeStatRevenue: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 4,
  },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  hourInfo: {
    width: 80,
  },
  hourText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },
  hourBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  hourBarFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },
});

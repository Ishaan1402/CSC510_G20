import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import type { TextStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LogoutButton } from "./src/components/LogoutButton";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { CheckoutPage } from "./src/screens/CheckoutPage";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MenuScreen } from "./src/screens/MenuScreen";
import { MerchantDashboardScreen } from "./src/screens/MerchantDashboardScreen";
import { OrderStatusScreen } from "./src/screens/OrderStatusScreen";
import { OrdersScreen } from "./src/screens/OrdersScreen";
import { PlannerScreen } from "./src/screens/PlannerScreen";
import { RestaurantsScreen } from "./src/screens/RestaurantsScreen";
import type { CustomerTabParamList, RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#F8FAFC",
  },
};

type HeaderTitleTextStyle = Pick<TextStyle, "fontWeight" | "fontSize" | "fontFamily"> & {
  color?: string;
};

const headerTitleStyle: HeaderTitleTextStyle = {
  fontWeight: "600" as TextStyle["fontWeight"],
};

const logoutHeaderOptions: NativeStackNavigationOptions = {
  headerRight: () => <LogoutButton />,
  headerTitleStyle,
};

const TripStack = createNativeStackNavigator<RootStackParamList>();

const TripStackNavigator = () => (
  <TripStack.Navigator initialRouteName="Planner">
    <TripStack.Screen
      name="Planner"
      component={PlannerScreen}
      options={{ headerShown: false, animation: "fade_from_bottom" }}
    />
    <TripStack.Screen
      name="Restaurants"
      component={RestaurantsScreen}
      options={{
        headerTitle: "Restaurants",
        animation: "slide_from_right",
        ...logoutHeaderOptions,
      }}
    />
    <TripStack.Screen
      name="Menu"
      component={MenuScreen}
      options={({ route }) => ({
        headerTitle: route.params.restaurant.name,
        animation: "slide_from_right",
        ...logoutHeaderOptions,
      })}
    />
    <TripStack.Screen
      name="Checkout"
      component={CheckoutPage}
      options={{
        headerTitle: "Checkout",
        animation: "slide_from_right",
        ...logoutHeaderOptions,
      }}
    />
    <TripStack.Screen
      name="OrderStatus"
      component={OrderStatusScreen}
      options={{
        headerTitle: "Order Status",
        animation: "slide_from_right",
        ...logoutHeaderOptions,
      }}
    />
  </TripStack.Navigator>
);

const OrdersStack = createNativeStackNavigator<RootStackParamList>();

const OrdersStackNavigator = () => (
  <OrdersStack.Navigator>
    <OrdersStack.Screen
      name="Orders"
      component={OrdersScreen}
      options={{
        headerTitle: "My Orders",
        animation: "fade_from_bottom",
        ...logoutHeaderOptions,
      }}
    />
    <OrdersStack.Screen
      name="OrderStatus"
      component={OrderStatusScreen}
      options={{
        headerTitle: "Order Status",
        animation: "slide_from_right",
        ...logoutHeaderOptions,
      }}
    />
  </OrdersStack.Navigator>
);

const CustomerNavigator = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen
      name="Trip"
      component={TripStackNavigator}
      options={{ tabBarLabel: "Plan Route" }}
    />
    <Tab.Screen
      name="PreviousOrders"
      component={OrdersStackNavigator}
      options={{ tabBarLabel: "My Orders" }}
    />
  </Tab.Navigator>
);

const MerchantNavigator = () => (
  <Stack.Navigator initialRouteName="MerchantDashboard">
    <Stack.Screen
      name="MerchantDashboard"
      component={MerchantDashboardScreen}
      options={{
        headerTitle: "Merchant Dashboard",
        animation: "fade_from_bottom",
      }}
    />
    <Stack.Screen
      name="Restaurants"
      component={RestaurantsScreen}
      options={{
        headerTitle: "Restaurants",
        animation: "slide_from_right",
        ...logoutHeaderOptions,
      }}
    />
    <Stack.Screen
      name="Menu"
      component={MenuScreen}
      options={({ route }) => ({
        headerTitle: route.params.restaurant.name,
        animation: "slide_from_right",
      })}
    />  
  </Stack.Navigator>
);

const PublicNavigator = () => (
  <Stack.Navigator initialRouteName="Login">
    <Stack.Screen
      name="Login"
      component={LoginScreen}
      options={{ headerShown: false, animation: "fade_from_bottom" }}
    />
  </Stack.Navigator>
);

const Router = () => {
  const { isAuthenticated, isHydrating, user } = useAuth();

  useEffect(() => {
    // We can potentially perform analytics or warmups when auth state changes.
  }, [isAuthenticated]);

  if (isHydrating) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={AppTheme}>
      {isAuthenticated ? (
        user?.role === "RESTAURANT" ? (
          <MerchantNavigator />
        ) : (
          <CustomerNavigator />
        )
      ) : (
        <PublicNavigator />
      )}
    </NavigationContainer>
  );
};

const App = () => (
  <AuthProvider>
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Router />
    </SafeAreaProvider>
  </AuthProvider>
);

export default App;

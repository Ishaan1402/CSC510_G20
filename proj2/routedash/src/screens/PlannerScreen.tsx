// src/screens/PlannerScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { LatLng, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoutButton } from "../components/LogoutButton";
import { StopTypeToggle } from "../components/StopTypeToggle";
import { VehicleTypeSelector } from "../components/VehicleTypeSelector";
import { useAuth } from "../context/AuthContext";
import { useDirections, type Waypoint } from "../hooks/useDirections";
import { useEVStations } from "../hooks/useEVStations";
import { useGasStationDetails } from "../hooks/useGasStationDetails";
import { useGasStations, type GasStation } from "../hooks/useGasStations";
import { PlaceSuggestion, usePlacesAutocomplete } from "../hooks/usePlacesAutocomplete";
import { useRestaurantRecommendations } from "../hooks/useRestaurantRecommendations";
import type { Restaurant as RecommendedRestaurant } from "../hooks/useRestaurantRecommendations";
import { useUserProfile } from "../hooks/useUserProfile";
import {
  RootStackParamList,
  RestaurantSummary,
  TripContext,
  type VehicleType,
} from "../navigation/types";
import type {
  SavedTrip,
  SavedTripWaypoint,
  SavedTripRouteSnapshot,
} from "../types/savedTrip";
import { saveNewTrip,  } from "../utils/savedTripsStorage";

const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const formatDistance = (meters: number) => {
  if (!meters) return "—";
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const computeRegionFromCoordinates = (points: LatLng[]) => {
  if (!points.length) return DEFAULT_REGION;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max(0.02, (maxLat - minLat) * 1.4);
  const longitudeDelta = Math.max(0.02, (maxLng - minLng) * 1.4);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
};

export const PlannerScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const params = (route?.params ?? {}) as {
    fromSavedTrip?: boolean;
    savedTrip?: SavedTrip;
  };

  const {
    error: directionsError,
    fetchRoute,
    isLoading: isDirectionsLoading,
    reset,
    result,
  } = useDirections();
  const gasStationDetails = useGasStationDetails();
  const originAutocomplete = usePlacesAutocomplete();
  const destinationAutocomplete = usePlacesAutocomplete();

  const {
    error: recommendationsError,
    fetchRestaurants,
    isLoading: isRecommendationsLoading,
    items: restaurantRecommendations,
    targetTravelMinutes,
    reset: resetRecommendations,
  } = useRestaurantRecommendations();

  const {
    error: gasStationsError,
    fetchGasStations,
    isLoading: isGasStationsLoading,
    items: gasStations,
    targetTravelMinutes: gasTargetTravelMinutes,
    reset: resetGasStations,
  } = useGasStations();

  const {
    error: evStationsError,
    fetchEVStations,
    isLoading: isEVStationsLoading,
    items: evStations,
    targetTravelMinutes: evTargetTravelMinutes,
    reset: resetEVStations,
  } = useEVStations();

  const { updateVehicleType } = useUserProfile();

  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [isRoutePlotted, setIsRoutePlotted] = useState(false);
  const [mealWindow, setMealWindow] = useState<number>(35);
  const [refuelTimeMin, setRefuelTimeMin] = useState<number>(0);
  const [stopTypeFilter, setStopTypeFilter] = useState<"restaurants" | "stations" | "both">(
    "both",
  );
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    (user?.vehicleType as VehicleType) ?? null,
  );
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedGasStation, setSelectedGasStation] = useState<GasStation | null>(null);
  const [selectedRestaurants, setSelectedRestaurants] = useState<
    Map<string, RecommendedRestaurant>
  >(new Map());

  const window = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const originDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coordinates = useMemo(() => result?.coordinates ?? [], [result?.coordinates]);
  const startPoint: LatLng | undefined = coordinates[0];
  const endPoint: LatLng | undefined = coordinates[coordinates.length - 1];

  const totalMinutes = useMemo(
    () =>
      result?.leg.durationSeconds ? Math.max(Math.round(result.leg.durationSeconds / 60), 1) : null,
    [result?.leg.durationSeconds],
  );

  const region = useMemo(() => computeRegionFromCoordinates(coordinates), [coordinates]);
  const mapHeight = useMemo(() => Math.max(260, window.height * 0.33), [window.height]);
  const isCompactWidth = window.width < 380;
  const isCompactHeight = window.height < 760;
  const statSpacingStyle = useMemo(
    () => (isCompactWidth ? undefined : styles.statCardSpacing),
    [isCompactWidth],
  );
  const scrollContentDynamicStyle = useMemo(
    () => ({
      paddingHorizontal: isCompactWidth ? 16 : 24,
      paddingBottom: 120,
      flexGrow: 1,
    }),
    [isCompactWidth],
  );

  const sliderMin = totalMinutes ? 1 : 15;
  const sliderMax = totalMinutes ?? 120;
  const sliderStep = totalMinutes && totalMinutes <= 45 ? 1 : 5;
  const sliderValue = useMemo(
    () => Math.min(Math.max(mealWindow, sliderMin), sliderMax),
    [mealWindow, sliderMax, sliderMin],
  );

  const tripContext: TripContext = useMemo(
    () => ({
      origin,
      destination,
      pickupEtaMin: sliderValue,
      vehicleType,
      refuelTimeMin: refuelTimeMin || undefined,
    }),
    [destination, origin, sliderValue, vehicleType, refuelTimeMin],
  );

  useEffect(() => {
    if (coordinates.length && mapRef.current) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
  }, [coordinates]);

  useEffect(
    () => () => {
      if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
      if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
    },
    [],
  );

  const handlePreviewRoute = async () => {
    const success = await fetchRoute(
      origin,
      destination,
      waypoints.length > 0 ? waypoints : undefined,
    );
    if (success) setIsRoutePlotted(true);
  };

  const handleSelectGasStation = async (station: GasStation) => {
    setSelectedGasStation(station);

    if (station.id) {
      await gasStationDetails.fetchDetails(station.id);
    }

    const newWaypoint: Waypoint = {
      location: station.location,
      address: station.address,
    };

    const updatedWaypoints = [...waypoints, newWaypoint];
    setWaypoints(updatedWaypoints);

    if (origin && destination) {
      const success = await fetchRoute(origin, destination, updatedWaypoints);
      if (success) setIsRoutePlotted(true);
    }
  };

  const handleRemoveWaypoint = async (index: number) => {
    const removedWaypoint = waypoints[index];
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(updatedWaypoints);

    if (removedWaypoint) {
      const updatedRestaurants = new Map(selectedRestaurants);
      for (const [id, restaurant] of updatedRestaurants.entries()) {
        if (
          Math.abs(restaurant.location.latitude - removedWaypoint.location.latitude) < 0.0001 &&
          Math.abs(restaurant.location.longitude - removedWaypoint.location.longitude) < 0.0001
        ) {
          updatedRestaurants.delete(id);
          break;
        }
      }
      setSelectedRestaurants(updatedRestaurants);
    }

    if (origin && destination) {
      const success = await fetchRoute(
        origin,
        destination,
        updatedWaypoints.length > 0 ? updatedWaypoints : undefined,
      );
      if (success) setIsRoutePlotted(true);
    }
  };

  const handleExportToGoogleMaps = () => {
    if (!origin || !destination) return;

    const originEncoded = encodeURIComponent(origin);
    const destinationEncoded = encodeURIComponent(destination);

    const waypointsList: string[] = [];
    waypoints.forEach((waypoint) => {
      const coordPair = `${waypoint.location.latitude},${waypoint.location.longitude}`;
      waypointsList.push(encodeURIComponent(coordPair));
    });

    let mapsUrl = `https://www.google.com/maps/dir/?api=1`;
    mapsUrl += `&origin=${originEncoded}`;
    if (waypointsList.length > 0) {
      const waypointsString = waypointsList.join("|");
      mapsUrl += `&waypoints=${waypointsString}`;
    }
    mapsUrl += `&destination=${destinationEncoded}`;

    Linking.openURL(mapsUrl).catch((err: Error) => {
      console.warn("Failed to open Google Maps:", err);
    });
  };

  const handleOriginChange = (value: string) => {
    setOrigin(value);
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (!value.trim()) {
      originAutocomplete.clearSuggestions();
      return;
    }
    originDebounceRef.current = setTimeout(() => {
      originAutocomplete.fetchSuggestions(value).catch(() => {});
    }, 280);
  };

  const handleDestinationChange = (value: string) => {
    setDestination(value);
    if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
    if (!value.trim()) {
      destinationAutocomplete.clearSuggestions();
      return;
    }
    destinationDebounceRef.current = setTimeout(() => {
      destinationAutocomplete.fetchSuggestions(value).catch(() => {});
    }, 280);
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion, field: "origin" | "destination") => {
    if (field === "origin") {
      if (originDebounceRef.current) {
        clearTimeout(originDebounceRef.current);
        originDebounceRef.current = null;
      }
      setOrigin(suggestion.description);
      originAutocomplete.clearSuggestions();
    } else {
      if (destinationDebounceRef.current) {
        clearTimeout(destinationDebounceRef.current);
        destinationDebounceRef.current = null;
      }
      setDestination(suggestion.description);
      destinationAutocomplete.clearSuggestions();
    }
  };

  // load vehicle preference
  useEffect(() => {
    if (user) {
      if (user.vehicleType) {
        setVehicleType(user.vehicleType as VehicleType);
        setShowVehicleSelector(false);
      } else if (!showVehicleSelector) {
        setShowVehicleSelector(true);
      }
    }
  }, [user, showVehicleSelector]);

  // load from saved trip
  useEffect(() => {
  if (params.fromSavedTrip && params.savedTrip) {
    const t = params.savedTrip as SavedTrip;

    // Basic fields
    setOrigin(t.origin);
    setDestination(t.destination);
    setMealWindow(t.stopWindowMinutes);

    // stopType → filters
    if (t.stopType === "food") {
      setStopTypeFilter("restaurants");
    } else if (t.stopType === "gas" || t.stopType === "ev") {
      setStopTypeFilter("stations");
    } else {
      setStopTypeFilter("both");
    }

    if (t.stopType === "gas") {
      setVehicleType("GAS");
    } else if (t.stopType === "ev") {
      setVehicleType("EV");
    }

    // clear current route/search state
    setIsRoutePlotted(false);
    setSelectedGasStation(null);
    setSelectedRestaurants(new Map());
    reset();
    resetRecommendations();
    resetGasStations();
    resetEVStations();

    // Restore waypoints (if any)
    let restoredWaypoints: Waypoint[] = [];
    if (t.waypoints && t.waypoints.length) {
      restoredWaypoints = t.waypoints.map((wp) => ({
        location: {
          latitude: wp.latitude,
          longitude: wp.longitude,
        },
        address: wp.address ?? undefined,
      }));
      setWaypoints(restoredWaypoints);
    } else {
      setWaypoints([]);
    }

    // Recalculate route using saved origin/destination/waypoints
    if (t.origin && t.destination) {
      (async () => {
        const success = await fetchRoute(
          t.origin,
          t.destination,
          restoredWaypoints.length ? restoredWaypoints : undefined,
        );
        if (success) {
          setIsRoutePlotted(true);
        }
      })();
    }
  }
}, [params, reset, resetRecommendations, resetGasStations, resetEVStations, fetchRoute]);

  useEffect(() => {
    if (result?.coordinates?.length && result.leg.durationSeconds) {
      if (stopTypeFilter === "restaurants" || stopTypeFilter === "both") {
        fetchRestaurants(result.coordinates, result.leg.durationSeconds, sliderValue).catch(
          () => {},
        );
      } else {
        resetRecommendations();
      }

      if (
        (stopTypeFilter === "stations" || stopTypeFilter === "both") &&
        vehicleType &&
        result.coordinates.length &&
        result.leg.durationSeconds
      ) {
        const refuelSliderValue =
          refuelTimeMin || Math.max(1, Math.round((totalMinutes ?? 60) * 0.5));
        if (vehicleType === "GAS") {
          fetchGasStations(result.coordinates, result.leg.durationSeconds, refuelSliderValue).catch(
            () => {},
          );
        } else if (vehicleType === "EV") {
          fetchEVStations(result.coordinates, result.leg.durationSeconds, refuelSliderValue).catch(
            () => {},
          );
        }
      } else {
        resetGasStations();
        resetEVStations();
      }
    } else {
      resetRecommendations();
      resetGasStations();
      resetEVStations();
    }
  }, [
    fetchRestaurants,
    fetchGasStations,
    fetchEVStations,
    sliderValue,
    refuelTimeMin,
    resetRecommendations,
    resetGasStations,
    resetEVStations,
    result?.coordinates,
    result?.leg.durationSeconds,
    stopTypeFilter,
    vehicleType,
    totalMinutes,
  ]);

  useEffect(() => {
    if (!result?.coordinates?.length) setIsRoutePlotted(false);
  }, [result?.coordinates?.length]);

  const handleClearPlanner = () => {
    setOrigin("");
    setDestination("");
    setIsRoutePlotted(false);
    setMealWindow(35);
    setRefuelTimeMin(0);
    setWaypoints([]);
    setSelectedGasStation(null);
    setSelectedRestaurants(new Map());
    reset();
    resetRecommendations();
    resetGasStations();
    resetEVStations();
    gasStationDetails.reset();
    originAutocomplete.clearSuggestions();
    destinationAutocomplete.clearSuggestions();
    if (mapRef.current) {
      mapRef.current.animateToRegion(DEFAULT_REGION, 300);
    }
  };

  const handleVehicleTypeChange = async (newVehicleType: "GAS" | "EV") => {
    setVehicleType(newVehicleType);
    setShowVehicleSelector(false);
    try {
      await updateVehicleType(newVehicleType);
    } catch {
      // handled in hook
    }
  };

  useEffect(() => {
    if (totalMinutes) {
      const clamped = Math.min(Math.max(mealWindow, sliderMin), sliderMax);
      if (clamped !== mealWindow) setMealWindow(clamped);
    }
  }, [mealWindow, sliderMax, sliderMin, totalMinutes]);

  const statusLabel: string = useMemo(() => {
    if (isDirectionsLoading) return "Mapping your drive…";
    if (isRecommendationsLoading || isGasStationsLoading || isEVStationsLoading) {
      if (stopTypeFilter === "restaurants") return "Searching for restaurants…";
      if (stopTypeFilter === "stations") return "Searching for stations…";
      return "Searching for stops along your route…";
    }

    if (restaurantRecommendations.length || gasStations.length || evStations.length) {
      const parts: string[] = [];
      if (
        restaurantRecommendations.length &&
        (stopTypeFilter === "restaurants" || stopTypeFilter === "both")
      ) {
        parts.push(
          `${restaurantRecommendations.length} restaurant${
            restaurantRecommendations.length !== 1 ? "s" : ""
          }`,
        );
      }
      if (
        vehicleType === "GAS" &&
        gasStations.length &&
        (stopTypeFilter === "stations" || stopTypeFilter === "both")
      ) {
        parts.push(
          `${gasStations.length} gas station${gasStations.length !== 1 ? "s" : ""}`,
        );
      }
      if (
        vehicleType === "EV" &&
        evStations.length &&
        (stopTypeFilter === "stations" || stopTypeFilter === "both")
      ) {
        parts.push(
          `${evStations.length} EV station${evStations.length !== 1 ? "s" : ""}`,
        );
      }
      if (parts.length > 0) {
        return `Found ${parts.join(" and ")} along your route.`;
      }
    }

    if (recommendationsError || gasStationsError || evStationsError) {
      return "We couldn't load stop ideas just now. Try again in a moment.";
    }
    if (isRoutePlotted) {
      if (!vehicleType)
        return "Select your vehicle type to see gas/EV stations along your route.";
      return "Route ready — adjust the sliders to refresh recommendations.";
    }
    return "Plot a trip to discover great pickup stops along the way.";
  }, [
    isDirectionsLoading,
    isRecommendationsLoading,
    isGasStationsLoading,
    isEVStationsLoading,
    restaurantRecommendations.length,
    gasStations.length,
    evStations.length,
    targetTravelMinutes,
    recommendationsError,
    gasStationsError,
    evStationsError,
    isRoutePlotted,
    sliderValue,
    stopTypeFilter,
    vehicleType,
  ]);

  const handleSelectRestaurant = async (restaurant: RecommendedRestaurant) => {
    const isSelected = selectedRestaurants.has(restaurant.id);

    if (isSelected) {
      const updatedRestaurants = new Map(selectedRestaurants);
      updatedRestaurants.delete(restaurant.id);
      setSelectedRestaurants(updatedRestaurants);

      const updatedWaypoints = waypoints.filter((wp) => {
        return !(
          Math.abs(wp.location.latitude - restaurant.location.latitude) < 0.0001 &&
          Math.abs(wp.location.longitude - restaurant.location.longitude) < 0.0001
        );
      });
      setWaypoints(updatedWaypoints);

      if (origin && destination) {
        const success = await fetchRoute(
          origin,
          destination,
          updatedWaypoints.length > 0 ? updatedWaypoints : undefined,
        );
        if (success) setIsRoutePlotted(true);
      }
    } else {
      const newWaypoint: Waypoint = {
        location: restaurant.location,
        address: restaurant.address,
      };

      const updatedWaypoints = [...waypoints, newWaypoint];
      setWaypoints(updatedWaypoints);
      setSelectedRestaurants(new Map(selectedRestaurants).set(restaurant.id, restaurant));

      if (origin && destination) {
        const success = await fetchRoute(origin, destination, updatedWaypoints);
        if (success) setIsRoutePlotted(true);
      }
    }
  };

  const handleOpenRestaurantMenu = (restaurant: RecommendedRestaurant) => {
    if (!origin || !destination) return;

    const summary: RestaurantSummary = {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.location.latitude,
      longitude: restaurant.location.longitude,
    };

    navigation.navigate("Menu", { restaurant: summary, trip: tripContext });
  };

  const handleSavePlannerTrip = async () => {
  if (!origin.trim() || !destination.trim()) {
    alert("Please enter both a starting point and destination before saving.");
    return;
  }

  // Map your stopTypeFilter + vehicleType into SavedTrip.stopType
  let stopType: SavedTrip["stopType"] = "mixed";
  if (stopTypeFilter === "restaurants") {
    stopType = "food";
  } else if (stopTypeFilter === "stations") {
    if (vehicleType === "GAS") stopType = "gas";
    else if (vehicleType === "EV") stopType = "ev";
  }

  // Pick one selected restaurant if any (first value from the Map)
  const firstSelectedRestaurant = selectedRestaurants.values().next().value as
    | RecommendedRestaurant
    | undefined;

  // --- build routeSnapshot + waypointSnapshots ---
  let routeSnapshot: SavedTripRouteSnapshot | undefined;
  let waypointSnapshots: SavedTripWaypoint[] | undefined;

  if (result?.leg && coordinates.length) {
    waypointSnapshots = waypoints.map((wp) => {
      let kind: SavedTripWaypoint["kind"] = "unknown";

      // Is this waypoint one of the selected restaurants?
      for (const restaurant of selectedRestaurants.values()) {
        if (
          Math.abs(restaurant.location.latitude - wp.location.latitude) < 0.0001 &&
          Math.abs(restaurant.location.longitude - wp.location.longitude) < 0.0001
        ) {
          kind = "restaurant";
          break;
        }
      }

      if (kind === "unknown" && vehicleType === "GAS") {
        kind = "gas";
      } else if (kind === "unknown" && vehicleType === "EV") {
        kind = "ev";
      }

      return {
        latitude: wp.location.latitude,
        longitude: wp.location.longitude,
        address: wp.address,
        kind,
      };
    });

    routeSnapshot = {
      durationText: result.leg.durationText ?? "",
      distanceText: result.leg.distanceText ?? "",
      coordinates: coordinates.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    };
  }

  // --- restaurant snapshot with numeric priceLevel ---
  const restaurantSnapshot = firstSelectedRestaurant
    ? (() => {
        const raw = firstSelectedRestaurant.priceLevel;
        let priceLevel: number | null | undefined = null;

        if (typeof raw === "number") {
          priceLevel = raw;
        } else if (typeof raw === "string") {
          const parsed = Number(raw);
          priceLevel = Number.isFinite(parsed) ? parsed : null;
        } else {
          priceLevel = null;
        }

        return {
          id: firstSelectedRestaurant.id.toString(),
          name: firstSelectedRestaurant.name,
          address: firstSelectedRestaurant.address,
          rating: firstSelectedRestaurant.rating,
          priceLevel,
        };
      })()
    : undefined;

  const trip: SavedTrip = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),

    origin,
    destination,
    stopType,
    stopWindowMinutes: sliderValue,

    filters: {
      fastService: false,
      vegetarian: false,
      vegan: false,
      localFavorites: false,
      priceLevel: null,
    },

    restaurant: restaurantSnapshot,
    orderSummary: undefined,

    routeSnapshot,
    waypoints: waypointSnapshots,
  };

  try {
    await saveNewTrip(trip);
    alert("Trip saved! You can view it offline in Saved Trips.");
  } catch (err) {
    console.warn("Failed to save trip", err);
    alert("We couldn't save this trip just now. Please try again.");
  }
};
  const canPreview = Boolean(origin.trim()) && Boolean(destination.trim()) && !isDirectionsLoading;
  const canClear = Boolean(origin.trim() || destination.trim() || coordinates.length);
  const canAdjustMealWindow = Boolean(totalMinutes && sliderMax > sliderMin);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.brandBadge}>RouteDash</Text>
            <Text style={styles.headerTitle}>Trip Planner</Text>
            <Text style={styles.headerSubtitle}>{statusLabel}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              style={styles.merchantLink}
              onPress={() => navigation.navigate("SavedTrips")}
            >
              <Text style={styles.merchantText}>Saved Trips</Text>
            </Pressable>
            <LogoutButton />
          </View>
        </View>
        <View style={styles.userBadge}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? "R"}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.name ?? "Operator"}</Text>
            <Text style={styles.userEmail}>{user?.email ?? "demo@routedash.com"}</Text>
          </View>
          {user?.role === "RESTAURANT" ? (
            <Pressable
              style={styles.merchantLink}
              onPress={() => navigation.navigate("MerchantDashboard")}
            >
              <Text style={styles.merchantText}>Merchant</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.flexContainer}
        contentContainerStyle={[
          styles.scrollContent,
          isCompactHeight && styles.scrollContentCompact,
          scrollContentDynamicStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route details card */}
        <View style={[styles.formCard, isCompactWidth && styles.cardCompact]}>
          <Text style={styles.sectionTitle}>Route details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Starting point</Text>
            <TextInput
              style={styles.input}
              placeholder="123 Main St, Durham NC"
              value={origin}
              onChangeText={handleOriginChange}
              onBlur={originAutocomplete.clearSuggestions}
              autoCapitalize="none"
            />
            {originAutocomplete.isLoading ? (
              <Text style={styles.suggestionNote}>Searching for matching addresses…</Text>
            ) : null}
            {originAutocomplete.suggestions.length ? (
              <View style={styles.suggestionList}>
                {originAutocomplete.suggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion.id}
                    style={[
                      styles.suggestionRow,
                      index === originAutocomplete.suggestions.length - 1 &&
                        styles.suggestionRowLast,
                    ]}
                    onPress={() => handleSelectSuggestion(suggestion, "origin")}
                  >
                    <Text style={styles.suggestionPrimary}>{suggestion.primaryText}</Text>
                    {suggestion.secondaryText ? (
                      <Text style={styles.suggestionSecondary}>{suggestion.secondaryText}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Destination</Text>
            <TextInput
              style={styles.input}
              placeholder="500 Hillsborough St, Raleigh NC"
              value={destination}
              onChangeText={handleDestinationChange}
              onBlur={destinationAutocomplete.clearSuggestions}
              autoCapitalize="none"
            />
            {destinationAutocomplete.isLoading ? (
              <Text style={styles.suggestionNote}>Searching for matching addresses…</Text>
            ) : null}
            {destinationAutocomplete.suggestions.length ? (
              <View style={styles.suggestionList}>
                {destinationAutocomplete.suggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion.id}
                    style={[
                      styles.suggestionRow,
                      index === destinationAutocomplete.suggestions.length - 1 &&
                        styles.suggestionRowLast,
                    ]}
                    onPress={() => handleSelectSuggestion(suggestion, "destination")}
                  >
                    <Text style={styles.suggestionPrimary}>{suggestion.primaryText}</Text>
                    {suggestion.secondaryText ? (
                      <Text style={styles.suggestionSecondary}>{suggestion.secondaryText}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <Pressable
            style={[styles.primaryButton, !canPreview && styles.disabled]}
            disabled={!canPreview}
            onPress={handlePreviewRoute}
          >
            <Text style={styles.primaryButtonText}>
              {isDirectionsLoading ? "Calculating…" : "Preview route"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.secondaryButton,
              { marginTop: 12 },
              !origin.trim() || !destination.trim() ? styles.disabled : null,
            ]}
            disabled={!origin.trim() || !destination.trim()}
            onPress={handleSavePlannerTrip}
          >
            <Text style={styles.secondaryButtonText}>Save trip for later</Text>
          </Pressable>

          <View style={styles.mealWindowControl}>
            <View style={styles.mealWindowHeader}>
              <Text style={styles.inputLabel}>Preferred mealtime</Text>
              <Text style={styles.mealWindowValue}>
                {sliderValue} min{totalMinutes ? ` of ${totalMinutes} min` : ""}
              </Text>
            </View>
            <Slider
              style={styles.mealWindowSlider}
              minimumValue={sliderMin}
              maximumValue={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onValueChange={(value) => {
                const stepSize = sliderStep || 1;
                const next = Math.min(
                  Math.max(Math.round(value / stepSize) * stepSize, sliderMin),
                  sliderMax,
                );
                if (next !== mealWindow) setMealWindow(next);
              }}
              minimumTrackTintColor="#2563EB"
              maximumTrackTintColor="#CBD5F5"
              thumbTintColor={canAdjustMealWindow ? "#2563EB" : "#94A3B8"}
              disabled={!canAdjustMealWindow}
            />
            <View style={styles.mealWindowLabels}>
              <Text style={styles.mealWindowLabelText}>{sliderMin} min</Text>
              <Text style={styles.mealWindowLabelText}>{sliderMax} min</Text>
            </View>
            {!canAdjustMealWindow ? (
              <Text style={styles.suggestionNote}>
                Preview a route to unlock mealtime suggestions.
              </Text>
            ) : null}
          </View>

          {showVehicleSelector ? (
            <View style={styles.vehicleSelectorContainer}>
              <VehicleTypeSelector
                value={vehicleType ?? null}
                onValueChange={handleVehicleTypeChange}
              />
            </View>
          ) : null}

          {isRoutePlotted && vehicleType ? (
            <>
              <View style={styles.mealWindowControl}>
                <View style={styles.mealWindowHeader}>
                  <Text style={styles.inputLabel}>Refueling time</Text>
                  <Text style={styles.mealWindowValue}>
                    {refuelTimeMin || 0} min{totalMinutes ? ` of ${totalMinutes} min` : ""}
                  </Text>
                </View>
                <Slider
                  style={styles.mealWindowSlider}
                  minimumValue={sliderMin}
                  maximumValue={sliderMax}
                  step={sliderStep}
                  value={refuelTimeMin || sliderMin}
                  onValueChange={(value) => {
                    const stepSize = sliderStep || 1;
                    const next = Math.min(
                      Math.max(Math.round(value / stepSize) * stepSize, sliderMin),
                      sliderMax,
                    );
                    if (next !== refuelTimeMin) setRefuelTimeMin(next);
                  }}
                  minimumTrackTintColor="#2563EB"
                  maximumTrackTintColor="#CBD5F5"
                  thumbTintColor={canAdjustMealWindow ? "#2563EB" : "#94A3B8"}
                  disabled={!canAdjustMealWindow}
                />
                <View style={styles.mealWindowLabels}>
                  <Text style={styles.mealWindowLabelText}>{sliderMin} min</Text>
                  <Text style={styles.mealWindowLabelText}>{sliderMax} min</Text>
                </View>
              </View>

              <StopTypeToggle value={stopTypeFilter} onValueChange={setStopTypeFilter} />
            </>
          ) : null}

          <Pressable
            style={[styles.secondaryButton, styles.clearButton, !canClear && styles.disabled]}
            disabled={!canClear}
            onPress={handleClearPlanner}
          >
            <Text style={styles.secondaryButtonText}>Clear route</Text>
          </Pressable>

          {directionsError ? <Text style={styles.errorBanner}>{directionsError}</Text> : null}
          {originAutocomplete.error ? (
            <Text style={styles.inlineError}>{originAutocomplete.error}</Text>
          ) : null}
          {destinationAutocomplete.error ? (
            <Text style={styles.inlineError}>{destinationAutocomplete.error}</Text>
          ) : null}
        </View>

        {/* Map + stats */}
        <View style={[styles.mapCard, isCompactWidth && styles.cardCompact]}>
          <View style={styles.mapHeader}>
            <Text style={styles.sectionTitle}>Live route</Text>
            <Text style={styles.secondaryLabel}>
              {formatDistance(result?.leg.distanceMeters ?? 0)}
            </Text>
          </View>

          <View style={[styles.mapWrapper, { height: mapHeight }]}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              initialRegion={region}
              showsUserLocation={false}
              pitchEnabled
              scrollEnabled
              zoomEnabled
            >
              {coordinates.length ? (
                <>
                  <Polyline coordinates={coordinates} strokeColor="#2563eb" strokeWidth={5} />
                  {startPoint ? (
                    <Marker coordinate={startPoint} title="Origin" pinColor="#22c55e" />
                  ) : null}
                  {endPoint ? (
                    <Marker coordinate={endPoint} title="Destination" pinColor="#ef4444" />
                  ) : null}
                  {waypoints.map((waypoint, index) => (
                    <Marker
                      key={`waypoint-${index}`}
                      coordinate={waypoint.location}
                      title={`Stop ${index + 1}: ${waypoint.address || "Gas Station"}`}
                      pinColor="#22c55e"
                    />
                  ))}
                  {stopTypeFilter !== "restaurants" &&
                    vehicleType === "GAS" &&
                    gasStations.map((station) => {
                      const isWaypoint = waypoints.some(
                        (wp) =>
                          Math.abs(wp.location.latitude - station.location.latitude) < 0.0001 &&
                          Math.abs(wp.location.longitude - station.location.longitude) < 0.0001,
                      );
                      if (isWaypoint) return null;
                      return (
                        <Marker
                          key={station.id}
                          coordinate={station.location}
                          title={station.name}
                          pinColor="#f59e0b"
                        />
                      );
                    })}
                  {stopTypeFilter !== "restaurants" &&
                    vehicleType === "EV" &&
                    evStations.map((station) => (
                      <Marker
                        key={station.id}
                        coordinate={station.location}
                        title={station.name}
                        pinColor="#10b981"
                      />
                    ))}
                </>
              ) : null}
            </MapView>
          </View>

          <View style={styles.routeSummary}>
            <View style={[styles.statCard, statSpacingStyle]}>
              <Text style={styles.statLabel}>Drive time</Text>
              <Text style={styles.statValue}>{result?.leg.durationText ?? "—"}</Text>
            </View>
            <View style={[styles.statCard, statSpacingStyle]}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{result?.leg.distanceText ?? "—"}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Top picks</Text>
              <Text style={styles.statValue}>
                {isRecommendationsLoading
                  ? "…"
                  : restaurantRecommendations.length || (isRoutePlotted ? "0" : "—")}
              </Text>
            </View>
          </View>
        </View>

        {/* Route overview */}
        {isRoutePlotted ? (
          <View style={[styles.statusCard, isCompactWidth && styles.cardCompact]}>
            <Text style={styles.sectionTitle}>Route overview</Text>
            <View style={styles.routeSequence}>
              <View style={styles.routeStep}>
                <View style={[styles.routeStepIcon, styles.routeStepOrigin]}>
                  <Text style={styles.routeStepIconText}>S</Text>
                </View>
                <View style={styles.routeStepContent}>
                  <Text style={styles.routeStepLabel}>Start</Text>
                  <Text style={styles.routeStepValue} numberOfLines={2}>
                    {origin || result?.leg.startAddress || "Origin"}
                  </Text>
                </View>
              </View>

              {waypoints.length > 0 &&
                waypoints.map((waypoint, index) => {
                  let stopLabel = "Stop";
                  let stopIcon = "⛽";
                  let stopIconStyle = styles.routeStepGas;
                  let stopName = waypoint.address || "Gas Station";

                  for (const restaurant of selectedRestaurants.values()) {
                    if (
                      Math.abs(restaurant.location.latitude - waypoint.location.latitude) <
                        0.0001 &&
                      Math.abs(restaurant.location.longitude - waypoint.location.longitude) <
                        0.0001
                    ) {
                      stopLabel = "Restaurant";
                      stopIcon = "🍽️";
                      stopIconStyle = styles.routeStepRestaurant;
                      stopName = restaurant.name;
                      break;
                    }
                  }

                  return (
                    <View key={`waypoint-${index}`} style={styles.routeStep}>
                      <View style={styles.routeStepConnector} />
                      <View style={[styles.routeStepIcon, stopIconStyle]}>
                        <Text style={styles.routeStepIconText}>{stopIcon}</Text>
                      </View>
                      <View style={styles.routeStepContent}>
                        <Text style={styles.routeStepLabel}>
                          Stop {index + 1} - {stopLabel}
                        </Text>
                        <Text style={styles.routeStepValue} numberOfLines={2}>
                          {stopName}
                        </Text>
                      </View>
                    </View>
                  );
                })}

              {restaurantRecommendations.length > 0 &&
                selectedRestaurants.size === 0 &&
                (stopTypeFilter === "restaurants" || stopTypeFilter === "both") && (
                  <View style={styles.routeStep}>
                    <View style={styles.routeStepConnector} />
                    <View style={[styles.routeStepIcon, styles.routeStepRestaurant]}>
                      <Text style={styles.routeStepIconText}>🍽️</Text>
                    </View>
                    <View style={styles.routeStepContent}>
                      <Text style={styles.routeStepLabel}>
                        Restaurant{restaurantRecommendations.length > 1 ? "s" : ""} (optional)
                      </Text>
                      <Text style={styles.routeStepValue} numberOfLines={1}>
                        {restaurantRecommendations.length} option
                        {restaurantRecommendations.length !== 1 ? "s" : ""} near{" "}
                        {targetTravelMinutes || mealWindow} min mark
                      </Text>
                    </View>
                  </View>
                )}

              {(stopTypeFilter === "stations" || stopTypeFilter === "both") &&
                vehicleType === "GAS" &&
                gasStations.length > 0 &&
                waypoints.length === 0 && (
                  <View style={styles.routeStep}>
                    <View style={styles.routeStepConnector} />
                    <View style={[styles.routeStepIcon, styles.routeStepGas]}>
                      <Text style={styles.routeStepIconText}>⛽</Text>
                    </View>
                    <View style={styles.routeStepContent}>
                      <Text style={styles.routeStepLabel}>Gas Stations (optional)</Text>
                      <Text style={styles.routeStepValue} numberOfLines={1}>
                        {gasStations.length} station{gasStations.length !== 1 ? "s" : ""} near{" "}
                        {gasTargetTravelMinutes || refuelTimeMin || 0} min mark
                      </Text>
                    </View>
                  </View>
                )}

              {(stopTypeFilter === "stations" || stopTypeFilter === "both") &&
                vehicleType === "EV" &&
                evStations.length > 0 && (
                  <View style={styles.routeStep}>
                    <View style={styles.routeStepConnector} />
                    <View style={[styles.routeStepIcon, styles.routeStepRestaurant]}>
                      <Text style={styles.routeStepIconText}>🔌</Text>
                    </View>
                    <View style={styles.routeStepContent}>
                      <Text style={styles.routeStepLabel}>EV Stations (optional)</Text>
                      <Text style={styles.routeStepValue} numberOfLines={1}>
                        {evStations.length} station{evStations.length !== 1 ? "s" : ""} near{" "}
                        {evTargetTravelMinutes || refuelTimeMin || 0} min mark
                      </Text>
                    </View>
                  </View>
                )}

              <View style={styles.routeStep}>
                <View style={styles.routeStepConnector} />
                <View style={[styles.routeStepIcon, styles.routeStepDestination]}>
                  <Text style={styles.routeStepIconText}>E</Text>
                </View>
                <View style={styles.routeStepContent}>
                  <Text style={styles.routeStepLabel}>End</Text>
                  <Text style={styles.routeStepValue} numberOfLines={2}>
                    {destination || result?.leg.endAddress || "Destination"}
                  </Text>
                </View>
              </View>
            </View>
            {result?.leg.durationText && result?.leg.distanceText ? (
              <Text style={styles.routeSummaryText}>
                {result.leg.durationText} • {result.leg.distanceText}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Restaurant picks */}
        {isRoutePlotted && (stopTypeFilter === "restaurants" || stopTypeFilter === "both") ? (
          <View style={[styles.statusCard, isCompactWidth && styles.cardCompact]}>
            <Text style={styles.sectionTitle}>Restaurant picks</Text>
            <Text style={styles.detailSubtitle}>
              {targetTravelMinutes
                ? `Close to the ${targetTravelMinutes}-minute mark of your trip`
                : `Aiming for the ${mealWindow}-minute window`}
            </Text>

            {isRecommendationsLoading ? (
              <Text style={styles.suggestionNote}>
                Finding popular restaurants near your route…
              </Text>
            ) : restaurantRecommendations.length ? (
              <View style={styles.recommendationList}>
                {restaurantRecommendations.map((restaurant) => {
                  const isSelected = selectedRestaurants.has(restaurant.id);
                  return (
                    <Pressable
                      key={restaurant.id}
                      style={[
                        styles.recommendationItem,
                        isSelected && styles.recommendationItemSelected,
                      ]}
                      onPress={() => handleSelectRestaurant(restaurant)}
                      onLongPress={() => handleOpenRestaurantMenu(restaurant)}
                    >
                      <View style={styles.recommendationHeader}>
                        <Text style={styles.recommendationName}>{restaurant.name}</Text>
                        {isSelected && <Text style={styles.selectedBadge}>Added to route</Text>}
                      </View>
                      <Text style={styles.recommendationMeta}>{restaurant.address}</Text>
                      <Text style={styles.recommendationMeta}>
                        {restaurant.travelTimeMinutes
                          ? `~${restaurant.travelTimeMinutes} min from start`
                          : "Along your current route"}
                      </Text>
                      {isSelected ? (
                        <Text style={styles.suggestionNote}>
                          Tap to remove • Long press for menu
                        </Text>
                      ) : (
                        <Text style={styles.suggestionNote}>
                          Tap to add to route • Long press for menu
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.suggestionNote}>
                We didn't spot standout restaurants near that window. Try tweaking the route or
                search again shortly.
              </Text>
            )}

            {recommendationsError ? (
              <Text style={styles.inlineError}>{recommendationsError}</Text>
            ) : null}
            <Pressable
              style={[
                styles.secondaryButton,
                styles.browseButton,
                (!origin || !destination) && styles.disabled,
              ]}
              disabled={!origin || !destination}
              onPress={() => navigation.navigate("Restaurants", { trip: tripContext })}
            >
              <Text style={styles.secondaryButtonText}>Browse all registered restaurants</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Gas stations */}
        {isRoutePlotted &&
          vehicleType === "GAS" &&
          (stopTypeFilter === "stations" || stopTypeFilter === "both") && (
            <View style={[styles.statusCard, isCompactWidth && styles.cardCompact]}>
              <Text style={styles.sectionTitle}>Gas stations</Text>
              <Text style={styles.detailSubtitle}>
                {gasTargetTravelMinutes
                  ? `Close to the ${gasTargetTravelMinutes}-minute mark of your trip`
                  : `Aiming for the ${refuelTimeMin || 0}-minute window`}
              </Text>

              {isGasStationsLoading ? (
                <Text style={styles.suggestionNote}>
                  Finding gas stations near your route…
                </Text>
              ) : gasStations.length ? (
                <View style={styles.recommendationList}>
                  {gasStations.map((station) => {
                    const isSelected = waypoints.some(
                      (wp) =>
                        Math.abs(wp.location.latitude - station.location.latitude) < 0.0001 &&
                        Math.abs(wp.location.longitude - station.location.longitude) < 0.0001,
                    );
                    const stationPrices =
                      selectedGasStation?.id === station.id
                        ? gasStationDetails.prices
                        : station.prices;

                    return (
                      <Pressable
                        key={station.id}
                        style={[
                          styles.recommendationItem,
                          isSelected && styles.recommendationItemSelected,
                        ]}
                        onPress={() => handleSelectGasStation(station)}
                      >
                        <View style={styles.recommendationHeader}>
                          <Text style={styles.recommendationName}>{station.name}</Text>
                          {isSelected && (
                            <Text style={styles.selectedBadge}>Added to route</Text>
                          )}
                        </View>
                        <Text style={styles.recommendationMeta}>{station.address}</Text>
                        <Text style={styles.recommendationMeta}>
                          {station.travelTimeMinutes
                            ? `~${station.travelTimeMinutes} min from start`
                            : "Along your current route"}
                        </Text>
                        {stationPrices && stationPrices.length > 0 ? (
                          <View style={styles.priceContainer}>
                            {stationPrices.map((price, idx) => (
                              <Text key={idx} style={styles.priceText}>
                                {price.type}: {price.currency}{" "}
                                {typeof price.price === "number"
                                  ? price.price.toFixed(2)
                                  : price.price}
                              </Text>
                            ))}
                          </View>
                        ) : selectedGasStation?.id === station.id &&
                          gasStationDetails.isLoading ? (
                          <Text style={styles.suggestionNote}>Checking for pricing…</Text>
                        ) : selectedGasStation?.id === station.id &&
                          !gasStationDetails.isLoading &&
                          !gasStationDetails.prices ? (
                          <Text style={styles.suggestionNote}>
                            Pricing not available for this station.
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.suggestionNote}>
                  We didn't find gas stations near that window. Try adjusting the refueling time or
                  search again shortly.
                </Text>
              )}

              {gasStationsError ? (
                <Text style={styles.inlineError}>{gasStationsError}</Text>
              ) : null}
            </View>
          )}

        {/* EV stations */}
        {isRoutePlotted &&
          vehicleType === "EV" &&
          (stopTypeFilter === "stations" || stopTypeFilter === "both") && (
            <View style={[styles.statusCard, isCompactWidth && styles.cardCompact]}>
              <Text style={styles.sectionTitle}>EV charging stations</Text>
              <Text style={styles.detailSubtitle}>
                {evTargetTravelMinutes
                  ? `Close to the ${evTargetTravelMinutes}-minute mark of your trip`
                  : `Aiming for the ${refuelTimeMin || 0}-minute window`}
              </Text>

              {isEVStationsLoading ? (
                <Text style={styles.suggestionNote}>
                  Finding EV charging stations near your route…
                </Text>
              ) : evStations.length ? (
                <View style={styles.recommendationList}>
                  {evStations.map((station) => (
                    <View key={station.id} style={styles.recommendationItem}>
                      <View style={styles.recommendationHeader}>
                        <Text style={styles.recommendationName}>{station.name}</Text>
                      </View>
                      <Text style={styles.recommendationMeta}>{station.address}</Text>
                      <Text style={styles.recommendationMeta}>
                        {station.travelTimeMinutes
                          ? `~${station.travelTimeMinutes} min from start`
                          : "Along your current route"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.suggestionNote}>
                  We didn't find EV charging stations near that window. Try adjusting the refueling
                  time or search again shortly.
                </Text>
              )}

              {evStationsError ? (
                <Text style={styles.inlineError}>{evStationsError}</Text>
              ) : null}
            </View>
          )}

        {/* Route stops list */}
        {waypoints.length > 0 ? (
          <View style={[styles.statusCard, isCompactWidth && styles.cardCompact]}>
            <View style={styles.routeStopsHeader}>
              <Text style={styles.sectionTitle}>Route stops</Text>
              <Pressable style={styles.exportButton} onPress={handleExportToGoogleMaps}>
                <Text style={styles.exportButtonText}>Open in Maps</Text>
              </Pressable>
            </View>
            {waypoints.map((waypoint, index) => {
              let waypointName = waypoint.address || "Stop";
              let waypointType = "Gas Station";
              let waypointIcon = "⛽";

              for (const restaurant of selectedRestaurants.values()) {
                if (
                  Math.abs(restaurant.location.latitude - waypoint.location.latitude) < 0.0001 &&
                  Math.abs(restaurant.location.longitude - waypoint.location.longitude) < 0.0001
                ) {
                  waypointName = restaurant.name;
                  waypointType = "Restaurant";
                  waypointIcon = "🍽️";
                  break;
                }
              }

              return (
                <View key={index} style={styles.waypointItem}>
                  <View style={styles.waypointHeader}>
                    <View style={styles.waypointLeft}>
                      <Text style={styles.waypointNumber}>{index + 1}</Text>
                      <Text style={styles.waypointIconText}>{waypointIcon}</Text>
                    </View>
                    <View style={styles.waypointInfo}>
                      <Text style={styles.waypointName}>{waypointName}</Text>
                      <Text style={styles.waypointType}>{waypointType}</Text>
                    </View>
                    <Pressable
                      style={styles.removeWaypointButton}
                      onPress={() => handleRemoveWaypoint(index)}
                    >
                      <Text style={styles.removeWaypointText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Trip synopsis */}
        {result ? (
          <View style={[styles.statusCard, isCompactWidth && styles.cardCompact]}>
            <Text style={styles.sectionTitle}>Trip synopsis</Text>
            <Text style={styles.detailLabel}>Start</Text>
            <Text style={styles.detailValue}>{result.leg.startAddress}</Text>
            <Text style={styles.detailLabel}>Destination</Text>
            <Text style={styles.detailValue}>{result.leg.endAddress}</Text>
            <Text style={styles.detailLabel}>Estimated drive</Text>
            <Text
              style={styles.detailValue}
            >{`${result.leg.durationText} • ${result.leg.distanceText}`}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  flexContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: Platform.select({ ios: 12, android: 16 }),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 12,
  },
  headerInfo: {
    flexShrink: 1,
    minWidth: 0,
  },
  brandBadge: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginTop: 2,
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    flexWrap: "wrap",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  userName: {
    fontWeight: "700",
    color: "#0F172A",
    fontSize: 16,
  },
  userEmail: {
    color: "#475569",
    fontSize: 12,
  },
  userDetails: {
    marginLeft: 12,
  },
  merchantLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
  },
  merchantText: {
    color: "#0369A1",
    fontWeight: "600",
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
    flexGrow: 1,
  },
  scrollContentCompact: {
    paddingTop: 16,
    paddingBottom: 32,
    gap: 18,
  },
  cardCompact: {
    padding: 16,
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 0,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { height: 12, width: 0 },
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 16, android: 12 }),
    fontSize: 16,
    color: "#0F172A",
  },
  mealWindowControl: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  vehicleSelectorContainer: {
    marginTop: 18,
  },
  mealWindowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mealWindowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
  mealWindowSlider: {
    width: "100%",
    height: 40,
  },
  mealWindowLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  mealWindowLabelText: {
    fontSize: 12,
    color: "#64748B",
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
  },
  clearButton: {
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
  },
  browseButton: {
    marginTop: 12,
  },
  disabled: {
    opacity: 0.55,
  },
  errorBanner: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontSize: 14,
    lineHeight: 20,
  },
  inlineError: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    color: "#B91C1C",
    fontSize: 13,
  },
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 28,
    shadowOffset: { height: 14, width: 0 },
    elevation: 6,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryLabel: {
    fontWeight: "600",
    color: "#1E293B",
  },
  mapWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#E2E8F0",
  },
  map: {
    flex: 1,
  },
  routeSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  statCardSpacing: {
    marginRight: 12,
  },
  statLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  statValue: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "700",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { height: 12, width: 0 },
    elevation: 5,
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#64748B",
  },
  detailValue: {
    fontSize: 15,
    color: "#0F172A",
  },
  detailSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 10,
  },
  suggestionNote: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748B",
  },
  suggestionList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    maxHeight: 200,
  },
  suggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  suggestionSecondary: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  recommendationList: {
    marginTop: 8,
    gap: 12,
  },
  recommendationItem: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flexShrink: 1,
    paddingRight: 8,
  },
  recommendationMeta: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
  },
  recommendationItemSelected: {
    borderColor: "#22c55e",
    backgroundColor: "#F0FDF4",
  },
  selectedBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22c55e",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  priceText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 4,
  },
  waypointItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
  },
  waypointHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  waypointNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  removeWaypointButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  removeWaypointText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  routeSequence: {
    marginTop: 12,
    gap: 8,
  },
  routeStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  routeStepConnector: {
    position: "absolute",
    left: 14,
    top: 32,
    width: 2,
    height: 24,
    backgroundColor: "#CBD5F5",
  },
  routeStepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  routeStepOrigin: {
    backgroundColor: "#22c55e",
  },
  routeStepGas: {
    backgroundColor: "#f59e0b",
  },
  routeStepRestaurant: {
    backgroundColor: "#2563EB",
  },
  routeStepDestination: {
    backgroundColor: "#ef4444",
  },
  routeStepIconText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  routeStepContent: {
    flex: 1,
    paddingTop: 2,
  },
  routeStepLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#64748B",
    marginBottom: 2,
  },
  routeStepValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
  },
  routeSummaryText: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    textAlign: "center",
  },
  routeStopsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exportButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  waypointLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  waypointIconText: {
    fontSize: 16,
  },
  waypointType: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    textTransform: "uppercase",
    fontWeight: "600",
  },
});

export default PlannerScreen;
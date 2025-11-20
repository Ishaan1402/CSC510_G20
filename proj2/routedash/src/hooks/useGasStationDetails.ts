import Constants from "expo-constants";
import { useCallback, useMemo, useState } from "react";

import type { GasPrice } from "./useGasStations";

const PLACE_DETAILS_LEGACY_ENDPOINT = "https://maps.googleapis.com/maps/api/place/details/json";
const PLACE_DETAILS_NEW_ENDPOINT = "https://places.googleapis.com/v1/places";

const getApiKey = (): string => {
  const extra = Constants?.expoConfig?.extra ?? Constants?.manifest?.extra;
  return (extra?.googleMapsApiKey as string | undefined) ?? "";
};

type GasStationDetailsState = {
  isLoading: boolean;
  error: string | null;
  prices: GasPrice[] | null;
};

/**
 * Hook to fetch detailed information about a gas station, including fuel prices.
 * Uses Places API (New) for fuel pricing, with fallback to legacy API.
 */
export const useGasStationDetails = () => {
  const [{ isLoading, error, prices }, setState] = useState<GasStationDetailsState>({
    isLoading: false,
    error: null,
    prices: null,
  });

  const fetchDetails = useCallback(async (placeId: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setState({
        isLoading: false,
        error: "Missing Google Maps API key.",
        prices: null,
      });
      return null;
    }

    setState({ isLoading: true, error: null, prices: null });

    try {
      // Try Places API (New) first for fuel pricing
      try {
        const newApiResponse = await fetch(`${PLACE_DETAILS_NEW_ENDPOINT}/${placeId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "fuelOptions.fuelPrices,displayName,formattedAddress",
          },
        });

        if (newApiResponse.ok) {
          const newApiPayload = await newApiResponse.json();
          const fuelPrices: GasPrice[] = [];

          // Parse fuel prices from Places API (New) response
          if (newApiPayload.fuelOptions?.fuelPrices) {
            const prices = Array.isArray(newApiPayload.fuelOptions.fuelPrices)
              ? newApiPayload.fuelOptions.fuelPrices
              : [];

            prices.forEach((price: any) => {
              try {
                if (!price.type) return;

                // Handle different price formats from Places API (New)
                let priceValue = 0;
                let currency = "USD";

                if (price.price) {
                  // Price might be a number, string, or object with units/nanos
                  if (typeof price.price === "number") {
                    priceValue = price.price;
                  } else if (typeof price.price === "string") {
                    priceValue = parseFloat(price.price) || 0;
                  } else if (typeof price.price === "object") {
                    // Places API (New) uses { units: number, nanos: number } format
                    if (typeof price.price.units === "number") {
                      priceValue = price.price.units;
                      if (typeof price.price.nanos === "number" && price.price.nanos > 0) {
                        priceValue += price.price.nanos / 1e9;
                      }
                    } else if (typeof price.price.value === "number") {
                      priceValue = price.price.value;
                    }
                  }
                } else if (price.amount) {
                  // Alternative field name
                  priceValue = typeof price.amount === "number" ? price.amount : parseFloat(price.amount) || 0;
                }

                // Get currency
                if (price.currency) {
                  currency = price.currency;
                } else if (price.currencyCode) {
                  currency = price.currencyCode;
                } else if (price.price?.currencyCode) {
                  currency = price.price.currencyCode;
                }

                // Only add if we have a valid price
                if (priceValue > 0) {
                  fuelPrices.push({
                    type: price.type || "Regular",
                    price: priceValue,
                    currency: currency,
                    lastUpdated: price.updateTime || price.update_time || price.lastUpdated,
                  });
                }
              } catch (priceError) {
                console.warn("Error parsing fuel price:", priceError, price);
                // Skip this price but continue with others
              }
            });
          }

          if (fuelPrices.length > 0) {
            setState({
              isLoading: false,
              error: null,
              prices: fuelPrices,
            });
            return fuelPrices;
          }
        }
      } catch (newApiError) {
        // If Places API (New) fails, fall back to legacy API
        console.log("Places API (New) not available, trying legacy API", newApiError);
      }

      // Fallback to legacy Places API (won't have fuel prices, but won't error)
      const params = new URLSearchParams({
        place_id: placeId,
        fields: "name,formatted_address,price_level,rating,user_ratings_total",
        key: apiKey,
      });

      const response = await fetch(`${PLACE_DETAILS_LEGACY_ENDPOINT}?${params.toString()}`);
      const payload = await response.json();

      if (payload.status !== "OK") {
        // If place not found, that's okay - just return empty
        if (payload.status === "ZERO_RESULTS" || payload.error_message?.includes("not found")) {
          setState({
            isLoading: false,
            error: null,
            prices: [],
          });
          return [];
        }
        throw new Error(payload.error_message ?? "Failed to fetch gas station details");
      }

      // Legacy API doesn't have fuel prices, return null
      setState({
        isLoading: false,
        error: null,
        prices: null,
      });

      return null;
    } catch (detailsError) {
      console.warn("RouteDash useGasStationDetails: failed to fetch details", detailsError);
      setState({
        isLoading: false,
        error: null,
        prices: null,
      });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      prices: null,
    });
  }, []);

  return useMemo(
    () => ({
      isLoading,
      error,
      prices,
      fetchDetails,
      reset,
    }),
    [error, fetchDetails, isLoading, prices, reset],
  );
};

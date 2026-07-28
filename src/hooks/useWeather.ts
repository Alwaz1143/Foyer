"use client";

import { useState, useEffect } from "react";
import { useLocation } from "./useLocation";

export interface ForecastDay {
  day: string;
  icon: string;
  condition: string;
  high: number;
  low: number;
}

export interface WeatherData {
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  high: number;
  low: number;
  humidity: number;
  windSpeed: number;
  forecast: ForecastDay[];
}

const WMO_CODES: Record<number, { condition: string; icon: string }> = {
  0: { condition: "Clear", icon: "☀️" },
  1: { condition: "Mainly Clear", icon: "🌤️" },
  2: { condition: "Partly Cloudy", icon: "⛅" },
  3: { condition: "Overcast", icon: "☁️" },
  45: { condition: "Foggy", icon: "🌫️" },
  48: { condition: "Foggy", icon: "🌫️" },
  51: { condition: "Light Drizzle", icon: "🌦️" },
  53: { condition: "Drizzle", icon: "🌦️" },
  55: { condition: "Heavy Drizzle", icon: "🌧️" },
  61: { condition: "Light Rain", icon: "🌦️" },
  63: { condition: "Rain", icon: "🌧️" },
  65: { condition: "Heavy Rain", icon: "🌧️" },
  71: { condition: "Light Snow", icon: "🌨️" },
  73: { condition: "Snow", icon: "❄️" },
  75: { condition: "Heavy Snow", icon: "❄️" },
  80: { condition: "Rain Showers", icon: "🌦️" },
  81: { condition: "Rain Showers", icon: "🌧️" },
  82: { condition: "Heavy Rain", icon: "🌧️" },
  95: { condition: "Thunderstorm", icon: "⛈️" },
  96: { condition: "Thunderstorm", icon: "⛈️" },
  99: { condition: "Thunderstorm", icon: "⛈️" },
};

export function useWeather() {
  const { location, loading: locLoading } = useLocation();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
        );
        const data = await res.json();
        if (cancelled) return;

        const code = data.current?.weather_code ?? 0;
        const wmo = WMO_CODES[code] || { condition: "Unknown", icon: "🌡️" };

        const daily = data.daily;
        const dayFormatter = new Intl.DateTimeFormat("en", { weekday: "short" });
        const forecast: ForecastDay[] = [];
        if (daily?.time) {
          for (let i = 0; i < Math.min(daily.time.length, 8); i++) {
            if (i === 0) continue;
            const dCode = daily.weather_code?.[i] ?? 0;
            const dWmo = WMO_CODES[dCode] || { condition: "Unknown", icon: "🌡️" };
            forecast.push({
              day: dayFormatter.format(new Date(daily.time[i] + "T12:00:00")),
              icon: dWmo.icon,
              condition: dWmo.condition,
              high: Math.round(daily.temperature_2m_max?.[i] ?? 0),
              low: Math.round(daily.temperature_2m_min?.[i] ?? 0),
            });
          }
        }

        setWeather({
          temp: Math.round(data.current?.temperature_2m ?? 0),
          feelsLike: Math.round(data.current?.apparent_temperature ?? 0),
          condition: wmo.condition,
          icon: wmo.icon,
          high: Math.round(daily?.temperature_2m_max?.[0] ?? 0),
          low: Math.round(daily?.temperature_2m_min?.[0] ?? 0),
          humidity: data.current?.relative_humidity_2m ?? 0,
          windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
          forecast,
        });
      } catch {
        // Silently fail
      }
      setLoading(false);
    };

    fetchWeather();
    const id = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [location]);

  return { weather, loading, location };
}

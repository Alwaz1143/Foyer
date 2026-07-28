"use client";

import { useWeather } from "@/hooks/useWeather";

export default function WeatherWidget() {
  const { weather, loading, location } = useWeather();

  if (loading) {
    return (
      <div className="widget widget-weather">
        <div className="weather-skeleton">
          <div className="weather-skeleton-icon"></div>
          <div className="weather-skeleton-line"></div>
          <div className="weather-skeleton-line short"></div>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="widget widget-weather">
      <div className="weather-icon">{weather.icon}</div>
      <div className="weather-temp">{weather.temp}°F</div>
      <div className="weather-condition">{weather.condition}</div>
      <div className="weather-feels">Feels like {weather.feelsLike}°</div>
      <div className="weather-divider"></div>
      <div className="weather-hilo">H: {weather.high}° L: {weather.low}°</div>
      {(weather.humidity > 0 || weather.windSpeed > 0) && (
        <div className="weather-extras">
          {weather.humidity > 0 && <span>💧 {weather.humidity}%</span>}
          {weather.windSpeed > 0 && <span>💨 {weather.windSpeed} mph</span>}
        </div>
      )}
      {location && <div className="weather-city">{location.city}</div>}
    </div>
  );
}

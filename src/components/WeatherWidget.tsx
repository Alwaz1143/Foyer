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
      <div className="weather-main">
        <span className="weather-icon">{weather.icon}</span>
        <span className="weather-temp">{weather.temp}°C</span>
        <span className="weather-cond-sep">·</span>
        <span className="weather-condition">{weather.condition}</span>
      </div>

      <div className="weather-sub">
        <span>Feels {weather.feelsLike}°</span>
        <span className="weather-dot">·</span>
        <span>H: {weather.high}° L: {weather.low}°</span>
      </div>

      {(weather.humidity > 0 || weather.windSpeed > 0 || location) && (
        <div className="weather-meta">
          {weather.humidity > 0 && <span>💧 {weather.humidity}%</span>}
          {weather.windSpeed > 0 && <span>💨 {weather.windSpeed} mph</span>}
          {location && <><span className="weather-dot">·</span><span>{location.city}</span></>}
        </div>
      )}

      {weather.forecast.length > 0 && (
        <>
          <div className="weather-divider"></div>
          <div className="weather-forecast">
            {weather.forecast.slice(0, 6).map((day) => (
              <div className="weather-forecast-day" key={day.day}>
                <span className="forecast-day-name">{day.day}</span>
                <span className="forecast-icon">{day.icon}</span>
                <span className="forecast-temps">{day.high}°</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

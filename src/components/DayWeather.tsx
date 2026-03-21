'use client';

import { WeatherForecast } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudFog,
  CloudLightning,
  Droplets,
  Thermometer,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudFog,
  CloudLightning,
};

interface DayWeatherProps {
  forecast: WeatherForecast;
  compact?: boolean;
}

/**
 * Weather display component for a single day
 * Shows temperature range, weather icon, precipitation, and contextual hint
 * Designed to integrate seamlessly into timeline and other trip pages
 */
export default function DayWeather({ forecast, compact = false }: DayWeatherProps) {
  const IconComponent = ICON_MAP[forecast.iconName] || Cloud;
  const avgTemp = Math.round((forecast.tempMax + forecast.tempMin) / 2);

  if (compact) {
    // Compact inline display for timeline headers
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <IconComponent size={14} className="text-slate-500" />
        <span className="font-medium text-slate-600">
          {forecast.tempMax.toFixed(0)}°
        </span>
        {forecast.precipitation > 0 && (
          <div className="flex items-center gap-0.5 text-slate-500">
            <Droplets size={12} />
            <span>{forecast.precipitation.toFixed(0)}mm</span>
          </div>
        )}
      </div>
    );
  }

  // Full card display for detailed view
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-5">
        {/* Header: Icon and Temperature */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-end gap-3">
            <div className="p-2 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm">
              <IconComponent size={32} className="text-slate-600" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">
                  {avgTemp}°
                </span>
                <span className="text-sm text-slate-500">
                  {forecast.tempMin.toFixed(0)}° – {forecast.tempMax.toFixed(0)}°
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 mt-0.5">
                {forecast.description}
              </p>
            </div>
          </div>
        </div>

        {/* Precipitation info */}
        {forecast.precipitation > 0 && (
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
            <Droplets size={16} className="text-blue-500" />
            <span>Precipitazioni: <span className="font-semibold">{forecast.precipitation.toFixed(1)} mm</span></span>
          </div>
        )}

        {/* Contextual hint */}
        {forecast.hint && (
          <div className="rounded-lg bg-white/50 px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed border border-white/70">
            {forecast.hint}
          </div>
        )}
      </div>
    </div>
  );
}

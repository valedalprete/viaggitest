/**
 * Weather utilities integrating Open-Meteo API
 * Free, no API key required, no rate limiting for reasonable use
 */

export interface WeatherForecast {
  date: string; // 'YYYY-MM-DD'
  tempMax: number; // °C
  tempMin: number; // °C
  precipitation: number; // mm
  weatherCode: number; // WMO code
  description: string; // 'Sunny', 'Rainy', etc.
  iconName: string; // Lucide icon name: 'Sun', 'CloudRain', etc.
  hint: string; // Context-aware message for the user
}

/**
 * WMO Weather interpretation codes to Lucide icon names and descriptions
 * Reference: https://open-meteo.com/en/docs
 */
const WMO_CODE_MAP: Record<
  number,
  { description: string; iconName: string; color: string }
> = {
  0: { description: 'Sereno', iconName: 'Sun', color: 'text-yellow-500' },
  1: { description: 'Principalmente sereno', iconName: 'Sun', color: 'text-yellow-400' },
  2: { description: 'Parzialmente nuvoloso', iconName: 'Cloud', color: 'text-gray-400' },
  3: { description: 'Nuvoloso', iconName: 'Cloud', color: 'text-gray-500' },
  45: { description: 'Nebbioso', iconName: 'CloudFog', color: 'text-gray-400' },
  48: { description: 'Nebbia con depositi di ghiaccio', iconName: 'CloudFog', color: 'text-blue-300' },
  51: { description: 'Leggera pioggia', iconName: 'CloudDrizzle', color: 'text-blue-400' },
  53: { description: 'Pioggia moderata', iconName: 'CloudDrizzle', color: 'text-blue-500' },
  55: { description: 'Pioggia densa', iconName: 'CloudRain', color: 'text-blue-600' },
  61: { description: 'Pioggia leggera', iconName: 'CloudRain', color: 'text-blue-500' },
  63: { description: 'Pioggia moderata', iconName: 'CloudRain', color: 'text-blue-600' },
  65: { description: 'Pioggia forte', iconName: 'CloudRain', color: 'text-blue-700' },
  71: { description: 'Leggera nevicata', iconName: 'Cloud', color: 'text-blue-200' },
  73: { description: 'Nevicata moderata', iconName: 'CloudSnow', color: 'text-blue-300' },
  75: { description: 'Nevicata forte', iconName: 'CloudSnow', color: 'text-blue-400' },
  77: { description: 'Chicchi di neve', iconName: 'CloudSnow', color: 'text-blue-300' },
  80: { description: 'Pioggia leggera intermittente', iconName: 'CloudRain', color: 'text-blue-400' },
  81: { description: 'Pioggia moderata intermittente', iconName: 'CloudRain', color: 'text-blue-600' },
  82: { description: 'Pioggia forte intermittente', iconName: 'CloudRain', color: 'text-blue-700' },
  85: { description: 'Leggera neve intermittente', iconName: 'CloudSnow', color: 'text-blue-300' },
  86: { description: 'Neve intermittente forte', iconName: 'CloudSnow', color: 'text-blue-400' },
  95: { description: 'Temporale', iconName: 'CloudLightning', color: 'text-purple-600' },
  96: { description: 'Temporale con grandine leggera', iconName: 'CloudLightning', color: 'text-purple-600' },
  99: { description: 'Temporale con grandine', iconName: 'CloudLightning', color: 'text-purple-700' },
};

/**
 * Generate context-aware hints based on weather conditions
 */
function getWeatherHint(tempMax: number, precipitation: number, code: number): string {
  // Rainy conditions
  if (code >= 51 && code <= 67) {
    return '☔ Possibile pioggia: valuta attività indoor o spostamenti anticipati';
  }
  if (code >= 80 && code <= 82) {
    return '🌧️ Pioggia intermittente: porta un ombrello o proteggi gli spostamenti';
  }

  // Snow/freezing conditions
  if (code >= 71 && code <= 86) {
    return '❄️ Nevicata prevista: attrezzati adeguatamente, spostamenti più lenti';
  }

  // Thunderstorms
  if (code >= 95 && code <= 99) {
    return '⚡ Temporale in arrivo: evita attività all\'aperto nelle ore critiche';
  }

  // Heat
  if (tempMax >= 30) {
    return '🌞 Temperature elevate: meglio pause frequenti e attività al coperto nelle ore centrali';
  }

  // Perfect conditions
  if (code <= 3 && tempMax >= 15 && tempMax < 30 && precipitation === 0) {
    return '✨ Giornata ideale per attività all\'aperto';
  }

  // Cool but clear
  if (code <= 3 && tempMax < 15) {
    return '🧥 Tempo sereno ma fresco: porta una giacca';
  }

  // Cloudy but dry
  if (code >= 2 && code <= 3 && precipitation === 0) {
    return '☁️ Nuvoloso ma asciutto: buono per esplorare senza preoccupazioni';
  }

  return '';
}

/**
 * Fetch weather forecast from Open-Meteo API
 * @param latitude Destination latitude
 * @param longitude Destination longitude
 * @param startDate Start date in 'YYYY-MM-DD' format
 * @param endDate End date in 'YYYY-MM-DD' format
 * @param timezone Optional timezone (default: 'auto')
 * @returns Array of daily forecasts
 */
export async function getWeatherForecast(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  timezone = 'auto'
): Promise<WeatherForecast[]> {
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      start_date: startDate,
      end_date: endDate,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
      timezone,
      temperature_unit: 'celsius',
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Weather API error:', response.statusText);
      return [];
    }

    const data = await response.json();

    if (!data.daily) {
      return [];
    }

    const { daily } = data;
    const forecasts: WeatherForecast[] = [];

    for (let i = 0; i < daily.time.length; i++) {
      const code = daily.weather_code[i];
      const codeData = WMO_CODE_MAP[code] || {
        description: 'Sconosciuto',
        iconName: 'Cloud',
        color: 'text-gray-400',
      };

      const tempMax = daily.temperature_2m_max[i];
      const tempMin = daily.temperature_2m_min[i];
      const precipitation = daily.precipitation_sum[i];

      forecasts.push({
        date: daily.time[i],
        tempMax,
        tempMin,
        precipitation,
        weatherCode: code,
        description: codeData.description,
        iconName: codeData.iconName,
        hint: getWeatherHint(tempMax, precipitation, code),
      });
    }

    return forecasts;
  } catch (error) {
    console.error('Error fetching weather:', error);
    return [];
  }
}

/**
 * Get icon color class based on weather code
 */
export function getWeatherIconColor(code: number): string {
  return WMO_CODE_MAP[code]?.color || 'text-gray-400';
}

/**
 * Get icon name for weather code
 */
export function getWeatherIconName(code: number): string {
  return WMO_CODE_MAP[code]?.iconName || 'Cloud';
}

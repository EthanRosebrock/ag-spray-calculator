const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Backward-compatible weather endpoint — redirects to location-based endpoint
app.get('/api/weather/current', async (req, res) => {
  // Default to Defiance, OH if no coords provided
  const lat = req.query.lat || 41.4389;
  const lon = req.query.lon || -84.3558;
  res.redirect(`/api/weather/location?lat=${lat}&lon=${lon}`);
});

// Location-based weather endpoint — calls Open-Meteo for real data
app.get('/api/weather/location', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    try {
      const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${latitude}&longitude=${longitude}`
        + '&current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
        + '&temperature_unit=fahrenheit&wind_speed_unit=mph';

      const apiRes = await axios.get(url, { timeout: 8000 });
      const c = apiRes.data.current;

      const weather = {
        temperature: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        windGust: c.wind_gusts_10m || undefined,
        windDirection: degreesToCompass(c.wind_direction_10m),
        pressure: +(c.surface_pressure / 33.8639).toFixed(2),
        dewPoint: c.dew_point_2m,
        timestamp: new Date().toISOString(),
        elevation: apiRes.data.elevation != null
          ? +(apiRes.data.elevation * 3.281).toFixed(0)
          : undefined,
        source: 'Open-Meteo',
      };

      res.json(weather);
    } catch (apiErr) {
      console.warn('Open-Meteo API failed, falling back to mock:', apiErr.message);
      const fallback = generateLocationWeather(latitude, longitude);
      res.json(fallback);
    }
  } catch (error) {
    console.error('Location weather error:', error);
    res.status(500).json({ error: 'Failed to fetch location weather' });
  }
});

// Nearby weather stations endpoint
app.get('/api/weather/stations', async (req, res) => {
  try {
    const { lat, lon, radius = 25 } = req.query;

    const stations = [
      {
        id: 'KDEFK',
        name: 'Defiance County Airport',
        distance: calculateDistance(lat, lon, 41.4389, -84.3558),
        latitude: 41.4389,
        longitude: -84.3558,
        elevation: 695
      },
      {
        id: 'KTOL',
        name: 'Toledo Express Airport',
        distance: calculateDistance(lat, lon, 41.5868, -83.8078),
        latitude: 41.5868,
        longitude: -83.8078,
        elevation: 683
      },
      {
        id: 'KFWA',
        name: 'Fort Wayne International',
        distance: calculateDistance(lat, lon, 40.9785, -85.1951),
        latitude: 40.9785,
        longitude: -85.1951,
        elevation: 815
      }
    ].filter(station => station.distance <= radius);

    res.json(stations);
  } catch (error) {
    console.error('Weather stations error:', error);
    res.status(500).json({ error: 'Failed to fetch weather stations' });
  }
});

// Mock products endpoint
app.get('/api/products', (req, res) => {
  const products = [
    {
      id: '1',
      name: 'Roundup PowerMAX',
      type: 'liquid',
      unit: 'fl oz / acre',
      defaultRate: 32,
      mixingOrder: 2,
      measurementUnit: 'fl_oz',
      rateBasis: 'per_acre'
    },
    {
      id: '2',
      name: 'Atrazine 4L',
      type: 'liquid',
      unit: 'qt / acre',
      defaultRate: 1.5,
      mixingOrder: 3,
      measurementUnit: 'qt',
      rateBasis: 'per_acre'
    },
    {
      id: '3',
      name: 'AMS',
      type: 'dry',
      unit: 'lbs / 100 gal water',
      defaultRate: 17,
      mixingOrder: 1,
      measurementUnit: 'lbs',
      rateBasis: 'per_100_gal'
    }
  ];
  res.json(products);
});

// Helper functions

function degreesToCompass(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}

function generateLocationWeather(lat, lon) {
  const hour = new Date().getHours();
  const month = new Date().getMonth();

  // Northwest Ohio specific weather patterns
  const isNorthwestOhio = lat > 41.2 && lat < 41.6 && lon > -84.8 && lon < -83.8;

  let baseTemp = 70;
  if (isNorthwestOhio) {
    baseTemp = month < 3 || month > 10 ? 40 + Math.random() * 20 : 65 + Math.random() * 25;
  }

  return {
    temperature: baseTemp,
    humidity: 50 + Math.random() * 35,
    windSpeed: 4 + Math.random() * 12,
    windGust: Math.random() > 0.6 ? 6 + Math.random() * 15 : undefined,
    windDirection: ['SW', 'W', 'NW', 'S', 'SE'][Math.floor(Math.random() * 5)],
    pressure: 29.8 + Math.random() * 0.6,
    dewPoint: baseTemp - (5 + Math.random() * 20),
    timestamp: new Date().toISOString(),
    elevation: isNorthwestOhio ? 700 + Math.random() * 100 : 800,
    source: 'Location Weather Service',
    visibility: 6 + Math.random() * 4,
    uvIndex: Math.max(0, 4 + Math.random() * 6)
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Enhanced weather endpoint
app.get('/api/weather/current', async (req, res) => {
  try {
    // Mock weather data with more detail - replace with real API later
    const baseWeather = {
      temperature: 72 + Math.random() * 20, // 72-92°F
      humidity: 50 + Math.random() * 30,    // 50-80%
      windSpeed: 3 + Math.random() * 12,    // 3-15 mph
      windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
      pressure: 29.8 + Math.random() * 0.6, // 29.8-30.4 inches
      dewPoint: 55 + Math.random() * 15,    // 55-70°F
      timestamp: new Date().toISOString()
    };

    // Add realistic wind gusts
    const gustChance = Math.random();
    if (gustChance > 0.7) {
      baseWeather.windGust = baseWeather.windSpeed + (2 + Math.random() * 8);
    }

    // Add time-based variations (temperature inversions in early morning)
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 8 && Math.random() > 0.6) {
      baseWeather.temperatureInversion = true;
    }

    res.json(baseWeather);
  } catch (error) {
    console.error('Weather API Error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Location-based weather endpoint
app.get('/api/weather/location', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const baseWeather = generateLocationWeather(parseFloat(lat), parseFloat(lon));
    res.json(baseWeather);
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
      unit: 'oz/acre',
      defaultRate: 32,
      mixingOrder: 2
    },
    {
      id: '2',
      name: 'Atrazine 4L',
      type: 'liquid',
      unit: 'qt/acre',
      defaultRate: 1.5,
      mixingOrder: 3
    },
    {
      id: '3',
      name: 'AMS',
      type: 'dry',
      unit: 'lbs/acre',
      defaultRate: 17,
      mixingOrder: 1
    }
  ];
  res.json(products);
});

// Helper functions
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

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

// Location-based weather endpoint — 3-tier waterfall: WU PWS → NWS → Open-Meteo
app.get('/api/weather/location', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // --- Tier 1: Weather Underground PWS ---
    if (process.env.WU_API_KEY) {
      try {
        const nearbyUrl = `https://api.weather.com/v3/location/near`
          + `?geocode=${latitude},${longitude}&product=pws&format=json`
          + `&apiKey=${process.env.WU_API_KEY}`;
        const nearbyRes = await axios.get(nearbyUrl, { timeout: 5000 });
        const stationId = nearbyRes.data?.location?.stationId?.[0];

        if (stationId) {
          const obsUrl = `https://api.weather.com/v2/pws/observations/current`
            + `?stationId=${stationId}&format=json&units=e`
            + `&apiKey=${process.env.WU_API_KEY}`;
          const obsRes = await axios.get(obsUrl, { timeout: 5000 });
          const obs = obsRes.data?.observations?.[0];

          if (obs && obs.imperial.temp != null && obs.imperial.temp > -80 && obs.humidity != null) {
            const weather = {
              temperature: obs.imperial.temp,
              humidity: obs.humidity,
              windSpeed: obs.imperial.windSpeed,
              windGust: obs.imperial.windGust || undefined,
              windDirection: degreesToCompass(obs.winddir),
              pressure: obs.imperial.pressure,
              dewPoint: obs.imperial.dewpt,
              timestamp: new Date().toISOString(),
              elevation: obs.imperial.elev != null ? obs.imperial.elev : undefined,
              source: 'Weather Underground PWS',
              stationName: obs.neighborhood || undefined,
              stationId: obs.stationID || undefined,
            };
            console.log(`Weather served from WU PWS: ${weather.stationId}`);
            return res.json(weather);
          }
        }
        console.warn('WU PWS: no nearby station or empty obs, falling through to NWS');
      } catch (wuErr) {
        console.warn('WU PWS failed, falling through to NWS:', wuErr.message);
      }
    }

    // --- Tier 2: NWS API ---
    try {
      const nwsHeaders = { 'User-Agent': 'ag-spray-calculator, contact@example.com' };

      const pointRes = await axios.get(
        `https://api.weather.gov/points/${latitude},${longitude}`,
        { timeout: 5000, headers: nwsHeaders }
      );
      const stationsUrl = pointRes.data?.properties?.observationStations;

      if (stationsUrl) {
        const stationsRes = await axios.get(stationsUrl, { timeout: 5000, headers: nwsHeaders });
        const firstStation = stationsRes.data?.features?.[0];
        const nwsStationId = firstStation?.properties?.stationIdentifier;
        const nwsStationName = firstStation?.properties?.name;
        const nwsElevation = firstStation?.properties?.elevation?.value; // meters

        if (nwsStationId) {
          const obsRes = await axios.get(
            `https://api.weather.gov/stations/${nwsStationId}/observations/latest`,
            { timeout: 5000, headers: nwsHeaders }
          );
          const props = obsRes.data?.properties;

          if (props) {
            const toF = (c) => c != null ? +(c * 9 / 5 + 32).toFixed(1) : null;
            const kphToMph = (k) => k != null ? +(k * 0.621371).toFixed(1) : null;
            const paToInHg = (p) => p != null ? +(p / 3386.39).toFixed(2) : null;

            const weather = {
              temperature: toF(props.temperature?.value),
              humidity: props.relativeHumidity?.value != null
                ? +props.relativeHumidity.value.toFixed(0)
                : undefined,
              windSpeed: kphToMph(props.windSpeed?.value) || 0,
              windGust: kphToMph(props.windGust?.value) || undefined,
              windDirection: props.windDirection?.value != null
                ? degreesToCompass(props.windDirection.value)
                : 'N/A',
              pressure: paToInHg(props.barometricPressure?.value) || undefined,
              dewPoint: toF(props.dewpoint?.value),
              timestamp: new Date().toISOString(),
              elevation: nwsElevation != null
                ? +(nwsElevation * 3.281).toFixed(0)
                : undefined,
              source: 'NWS',
              stationName: nwsStationName || undefined,
              stationId: nwsStationId || undefined,
            };
            console.log(`Weather served from NWS: ${weather.stationId}`);
            return res.json(weather);
          }
        }
      }
      console.warn('NWS: incomplete data, falling through to Open-Meteo');
    } catch (nwsErr) {
      console.warn('NWS failed, falling through to Open-Meteo:', nwsErr.message);
    }

    // --- Tier 3: Open-Meteo (existing fallback) ---
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
      console.log('Weather served from Open-Meteo');
      return res.json(weather);
    } catch (apiErr) {
      console.warn('Open-Meteo failed, falling back to mock:', apiErr.message);
    }

    // --- Tier 4: Mock data (last resort) ---
    const fallback = generateLocationWeather(latitude, longitude);
    res.json(fallback);
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

// --- State abbreviation → full name helper ---
function getStateName(abbr) {
  const states = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
    CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
    HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
    KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
    MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
    MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
    NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
    OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
    SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
    VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
    DC:'District of Columbia'
  };
  return states[(abbr || '').toUpperCase()] || abbr || '';
}

// --- Geocode endpoint: Census (primary) → Nominatim (fallback) ---
app.get('/api/geocode', async (req, res) => {
  const address = (req.query.address || '').trim();
  if (!address) {
    return res.status(400).json({ error: 'address query parameter is required' });
  }

  // Tier 1: US Census Geocoder
  try {
    const censusUrl = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress'
      + `?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current`
      + '&vintage=Current_Current&format=json';
    const censusRes = await axios.get(censusUrl, { timeout: 10000 });
    const matches = censusRes.data?.result?.addressMatches;

    if (matches && matches.length > 0) {
      const match = matches[0];
      const coords = match.coordinates;
      const geo = match.geographies;
      const countyArr = geo?.Counties || geo?.['County Subdivisions'] || [];
      const stateArr = geo?.States || [];
      const countyName = countyArr[0]?.BASENAME || countyArr[0]?.NAME || '';
      const stateAbbr = stateArr[0]?.STUSAB || match.addressComponents?.state || '';

      return res.json({
        latitude: +coords.y.toFixed(4),
        longitude: +coords.x.toFixed(4),
        city: match.addressComponents?.city || '',
        state: getStateName(stateAbbr),
        county: countyName ? `${countyName} County` : '',
        formattedAddress: match.matchedAddress || address
      });
    }
    console.log('Census geocoder: no matches, falling through to Nominatim');
  } catch (censusErr) {
    console.warn('Census geocoder failed, falling through to Nominatim:', censusErr.message);
  }

  // Tier 2: Nominatim / OpenStreetMap
  try {
    const nomUrl = 'https://nominatim.openstreetmap.org/search'
      + `?q=${encodeURIComponent(address)}&format=json&addressdetails=1`
      + '&countrycodes=us&limit=1';
    const nomRes = await axios.get(nomUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'ag-spray-calculator/1.0' }
    });
    const results = nomRes.data;

    if (results && results.length > 0) {
      const r = results[0];
      const addr = r.address || {};
      const stateAbbr = addr.state_code || addr['ISO3166-2-lvl4']?.split('-')[1] || '';
      const county = addr.county || '';

      return res.json({
        latitude: +parseFloat(r.lat).toFixed(4),
        longitude: +parseFloat(r.lon).toFixed(4),
        city: addr.city || addr.town || addr.village || addr.hamlet || '',
        state: getStateName(stateAbbr) || addr.state || '',
        county: county && !county.endsWith('County') ? `${county} County` : county,
        formattedAddress: r.display_name || address
      });
    }

    return res.status(404).json({ error: 'No results found for that address' });
  } catch (nomErr) {
    console.warn('Nominatim geocoder failed:', nomErr.message);
    return res.status(502).json({ error: 'Geocoding services unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

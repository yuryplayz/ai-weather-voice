//Load API keyfrom config.js
let OPENWEATHER_KEY = "";

function loadAPIKey() {
  if (window.APP_CONFIG && window.APP_CONFIG.OPENWEATHER_API_KEY) {
    OPENWEATHER_KEY = window.APP_CONFIG.OPENWEATHER_API_KEY.trim();
    console.log("✅ API key loaded:", OPENWEATHER_KEY ? "OK" : "MISSING");
    return true;
  }
  return false;
}

if (!loadAPIKey()) {
  console.warn("⏳ Waiting for config.js...");
  setTimeout(loadAPIKey, 600);
}


// ELEMENT REFERENCES

const form = document.getElementById("search-form");
const input = document.getElementById("city");
const result = document.getElementById("result");
const placeEl = document.getElementById("place");
const descEl = document.getElementById("desc");
const tempEl = document.getElementById("temp");
const feelsEl = document.getElementById("feels");
const iconEl = document.getElementById("icon");
const speakBtn = document.getElementById("speak-btn");
const stopBtn = document.getElementById("stop-btn");
const stopMusicBtn = document.getElementById("stop-music-btn");
const music = document.getElementById("music");
const forecastEl = document.getElementById("forecast");
const tempToggle = document.getElementById("temp-toggle");
const loadingOverlay = document.getElementById("loading-overlay");

let latestForecast = null;
let latestDailyForecast = null;
let isCelsius = true;


// MAP INITIALIZATION

let map;
let currentMarker = null;
let streetsLayer = null;
let isStreetsVisible = true;

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setTimeout(() => map?.invalidateSize(), 1000);

});

function initMap() {
  map = L.map("map").setView([20, 0], 2);
  streetsLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);
}


// WEATHER FETCH FUNCTIONS

async function getCoordinates(city) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geo API error");
  const data = await res.json();
  if (!data.length) throw new Error("City not found");
  return { lat: data[0].lat, lon: data[0].lon, country: data[0].country };
}

async function fetchWeather(lat, lon) {
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`;

  const [currentRes, forecastRes] = await Promise.all([fetch(currentUrl), fetch(forecastUrl)]);
  if (!currentRes.ok || !forecastRes.ok) throw new Error("Weather API error");

  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}


//  EVENT LISTENERS

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (!city) return;
  await loadCityWeather(city);
});

async function loadCityWeather(city) {
  showLoading(true);
  music.pause();
  music.currentTime = 0;
  music.src = "Songs/Timber - PitBull Snippet.m4a"; 
  music.play().catch(() => {});
  try {
    const coords = await getCoordinates(city);
    if (!coords || isNaN(coords.lat) || isNaN(coords.lon)) throw new Error("Invalid coordinates");

    const data = await fetchWeather(coords.lat, coords.lon);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Play International Love while loading
    music.pause();
    music.currentTime = 0;
    latestForecast = normalizeWeather(city, coords.country, data);
    latestDailyForecast = data.forecast;

    render(latestForecast, data);
    playMusicFor(latestForecast);
    showCityOnMap(coords.lat, coords.lon, `${city}, ${coords.country}`);
  } catch (err) {
    showError(err.message || "Could not fetch weather");
    console.error("❌ Error:", err);
  } finally {
    showLoading(false);
  }
}

speakBtn.addEventListener("click", () => {
  if (!latestForecast) return;
  speak(forecastToSpeech(latestForecast));
});

stopBtn.addEventListener("click", () => window.speechSynthesis.cancel());

stopMusicBtn.addEventListener("click", () => {
  music.pause();
  music.currentTime = 0;
});

tempToggle.addEventListener("click", () => {
  isCelsius = !isCelsius;
  tempToggle.textContent = isCelsius ? "°C" : "°F";
  if (latestForecast && latestDailyForecast) render(latestForecast, latestDailyForecast);
});


//  MUSIC BY WEATHER

function playMusicFor(w) {
  let src = "Songs/I Know You Want Me - PitBull Snippet.m4a";
  if (w.main.includes("rain")) src = "Songs/Rain Over Me - PitBull Snippet.m4a";
  else if (w.main.includes("snow")) src = "Songs/Time of our Lives - PitBull Snippet.m4a";
  else if (w.main.includes("clear")) src = "Songs/Fireball - PitBull Snippet.m4a";
  else if (w.main.includes("cloud")) src = "Songs/Don't Stop the Party - PitBull Snippet.m4a";
  else if (w.main.includes("thunder")) src = "Songs/Timber - PitBull Snippet.m4a";
  music.src = src;
  music.play().catch(() => {});
}


//  SPEECH

function forecastToSpeech(w) {
  return `Weather in ${w.name}. ${capitalize(w.description)}. Temperature ${w.tempC}°C, feels like ${w.feelsC}°C.`;
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.pitch = 0.8;
  utter.rate = 1.0;
  const voices = speechSynthesis.getVoices();
  utter.voice = voices.find(v => /male|en-US/i.test(v.name)) || voices[0];
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}


//  RENDER UI

function normalizeWeather(city, country, data) {
  const tempC = Math.round(data.current.main.temp);
  const feelsC = Math.round(data.current.main.feels_like);
  const tempF = Math.round(tempC * 9 / 5 + 32);
  const feelsF = Math.round(feelsC * 9 / 5 + 32);
  const description = data.current.weather?.[0]?.description ?? "—";
  const icon = data.current.weather?.[0]?.icon ?? "01d";
  const main = data.current.weather?.[0]?.main?.toLowerCase() ?? "";
  const isDay = data.current.weather?.[0]?.icon?.includes("d");
  return { name: `${city.toUpperCase()}, ${country}`, tempC, feelsC, tempF, feelsF, description, icon, main, isDay };
}

function render(w, data) {
  placeEl.textContent = w.name;
  descEl.textContent = capitalize(w.description);

  const tempUnit = isCelsius ? "°C" : "°F";
  const tempValue = isCelsius ? w.tempC : w.tempF;
  const feelsValue = isCelsius ? w.feelsC : w.feelsF;

  tempEl.textContent = `${tempValue}${tempUnit}`;
  feelsEl.textContent = `Feels like ${feelsValue}${tempUnit}`;
  iconEl.src = `https://openweathermap.org/img/wn/${w.icon}@2x.png`;
  result.classList.remove("hidden");

  document.body.classList.toggle("day-theme", w.isDay);
  document.body.classList.toggle("night-theme", !w.isDay);

  forecastEl.innerHTML = "";
  const daily = groupForecastByDay(data.forecast.list);
  daily.slice(0, 5).forEach(day => {
    const card = document.createElement("div");
    card.className = "forecast-card";
    const date = new Date(day.dt);
    const dayName = date.toLocaleDateString(undefined, { weekday: "short" });
    const temp = isCelsius ? Math.round(day.temp) : Math.round(day.temp * 9 / 5 + 32);
    card.innerHTML = `
      <h4>${dayName}</h4>
      <img src="https://openweathermap.org/img/wn/${day.icon}.png" alt="${day.desc}" />
      <p>${temp}${tempUnit}</p>
      <p>${capitalize(day.desc)}</p>`;
    forecastEl.appendChild(card);
  });
}

function groupForecastByDay(list) {
  const days = {};
  list.forEach(item => {
    const date = new Date(item.dt * 1000).toDateString();
    if (!days[date]) days[date] = { temps: [], desc: [], icons: [], dt: item.dt * 1000 };
    days[date].temps.push(item.main.temp);
    days[date].desc.push(item.weather[0].description);
    days[date].icons.push(item.weather[0].icon);
  });
  return Object.values(days).map(d => ({
    dt: d.dt,
    temp: d.temps.reduce((a, b) => a + b, 0) / d.temps.length,
    desc: d.desc[Math.floor(d.desc.length / 2)],
    icon: d.icons[Math.floor(d.icons.length / 2)],
  }));
}


// MAP FUNCTION + REFRESH

function showCityOnMap(lat, lon, name) {
  const container = document.getElementById("map-container");
  if (isNaN(lat) || isNaN(lon)) {
    console.warn("❌ Invalid coordinates:", lat, lon);
    showError("Could not display map — invalid location data.");
    return;
  }

  container.classList.add("visible");
  container.classList.remove("hidden");

  if (!map) {
    console.warn("Map not ready, retrying...");
    setTimeout(() => showCityOnMap(lat, lon, name), 300);
    return;
  }

  try {
    map.flyTo([lat, lon], 12, { duration: 1.3 });
  } catch {
    map.setView([lat, lon], 12);
  }

  if (currentMarker) map.removeLayer(currentMarker);
  currentMarker = L.marker([lat, lon])
    .bindPopup(`<b>${name}</b><br>Current Location`)
    .addTo(map)
    .openPopup();

  refreshMap(); // fix gray/half map
}

function refreshMap() {
  if (!map) return;
  setTimeout(() => map.invalidateSize(), 400);
}


//  UTILITIES

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function showLoading(show) {
  if (!loadingOverlay) return;
  loadingOverlay.classList.toggle("hidden", !show);
}

function showError(msg) {
  const toast = document.createElement("div");
  toast.className = "error-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}


// AUTO-DETECT USER LOCATION

async function detectLocationAndLoadWeather() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    if (data.city) {
      console.log("📍 Detected city:", data.city);
      await loadCityWeather(data.city);
    }
  } catch (e) {
    console.warn("Could not auto-detect location:", e);
  }
}

// Map controls
document.getElementById("zoom-in").addEventListener("click", () => map.zoomIn());
document.getElementById("zoom-out").addEventListener("click", () => map.zoomOut());
document.getElementById("toggle-streets").addEventListener("click", () => {
  if (isStreetsVisible) map.removeLayer(streetsLayer);
  else streetsLayer.addTo(map);
  isStreetsVisible = !isStreetsVisible;
});
document.getElementById("close-map").addEventListener("click", () => {
  document.getElementById("map-container").classList.add("hidden");
  map.setView([20, 0], 2);
});

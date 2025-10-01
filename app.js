const OPENWEATHER_KEY = window.APP_CONFIG?.OPENWEATHER_API_KEY ?? "";

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
const music = document.getElementById("music");

let latestForecast = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (!city) return;
  try {
    const coords = await getCoordinates(city);
    const data = await fetchWeather(coords.lat, coords.lon);
    latestForecast = normalizeWeather(city, coords.country, data);
    render(latestForecast);
    playMusicFor(latestForecast);
  } catch (err) {
    alert("Could not fetch weather. Check city name or your API key.");
    console.error(err);
  }
});

speakBtn.addEventListener("click", () => {
  if (!latestForecast) return;
  const text = forecastToSpeech(latestForecast);
  speak(text);
});

stopBtn.addEventListener("click", () => {
  window.speechSynthesis.cancel();
});

async function getCoordinates(city) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geo API error");
  const data = await res.json();
  if (!data.length) throw new Error("City not found");
  return { lat: data[0].lat, lon: data[0].lon, country: data[0].country };
}

async function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather API error");
  return res.json();
}

function normalizeWeather(city, country, data) {
  const temp = Math.round(data.current.temp);
  const feels = Math.round(data.current.feels_like);
  const description = data.current.weather?.[0]?.description ?? "—";
  const icon = data.current.weather?.[0]?.icon ?? "01d";
  const main = data.current.weather?.[0]?.main?.toLowerCase() ?? "";
  return { name: `${city}, ${country}`, temp, feels, description, icon, main };
}

function render(w) {
  placeEl.textContent = w.name;
  descEl.textContent = capitalize(w.description);
  tempEl.textContent = `${w.temp}°C`;
  feelsEl.textContent = `Feels like ${w.feels}°C`;
  iconEl.src = `https://openweathermap.org/img/wn/${w.icon}@2x.png`;
  iconEl.alt = w.description;
  result.classList.remove("hidden");
}

function forecastToSpeech(w) {
  return `Forecast for ${w.name}. ${capitalize(w.description)}. Temperature ${w.temp} degrees, feels like ${w.feels}.`;
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.pitch = 0.7;
  utter.rate = 0.9;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /male|english/i.test(v.name)) || voices[0];
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function playMusicFor(w) {
  let src = "assets/default.mp3";
  if (w.main.includes("rain")) src = "assets/rain.mp3";
  else if (w.main.includes("snow")) src = "assets/snow.mp3";
  else if (w.main.includes("clear")) src = "assets/sunny.mp3";

  music.src = src;
  music.play().catch(() => {});
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

speechSynthesis.onvoiceschanged = () => {};

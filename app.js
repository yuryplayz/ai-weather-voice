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
const forecastEl = document.getElementById("forecast");

let latestForecast = null;
let latestDailyForecast = null;
let isCelsius = true;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (!city) return;
  try {
    const coords = await getCoordinates(city);
    const data = await fetchWeather(coords.lat, coords.lon);
    latestForecast = normalizeWeather(city, coords.country, data);
    latestDailyForecast = data.daily; // Store the daily forecast data
    render(latestForecast, data.daily);
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
  const tempC = Math.round(data.current.temp);
  const feelsC = Math.round(data.current.feels_like);
  const tempF = Math.round((tempC * 9/5) + 32);
  const feelsF = Math.round((feelsC * 9/5) + 32);
  const description = data.current.weather?.[0]?.description ?? "—";
  const icon = data.current.weather?.[0]?.icon ?? "01d";
  const main = data.current.weather?.[0]?.main?.toLowerCase() ?? "";
  const currentTime = data.current.dt;
  const sunrise = data.current.sunrise;
  const sunset = data.current.sunset;
  const isDay = currentTime >= sunrise && currentTime < sunset;
  return { name: `${city.toUpperCase()}, ${country.toUpperCase()}`, tempC, feelsC, tempF, feelsF, description, icon, main, isDay };
}

function render(w, daily) {
  placeEl.textContent = w.name;
  descEl.textContent = capitalize(w.description);

  // Display temperature based on current unit preference
  const currentTemp = isCelsius ? w.tempC : w.tempF;
  const currentFeels = isCelsius ? w.feelsC : w.feelsF;
  const tempUnit = isCelsius ? '°C' : '°F';

  tempEl.textContent = `${currentTemp}${tempUnit}`;
  feelsEl.textContent = `Feels like ${currentFeels}${tempUnit}`;
  iconEl.src = `https://openweathermap.org/img/wn/${w.icon}@2x.png`;
  iconEl.alt = w.description;
  result.classList.remove("hidden");

  // Apply day/night theme
  if (w.isDay) {
    document.body.classList.add('day-theme');
    document.body.classList.remove('night-theme');
  } else {
    document.body.classList.add('night-theme');
    document.body.classList.remove('day-theme');
  }

  // 5-day forecast
  forecastEl.innerHTML = "";
  daily.slice(1, 6).forEach(day => {
    const card = document.createElement("div");
    card.className = "forecast-card";

    const date = new Date(day.dt * 1000);
    const options = { weekday: "short" };
    const dayName = date.toLocaleDateString(undefined, options);

    const tempDay = isCelsius ? Math.round(day.temp.day) : Math.round((day.temp.day * 9/5) + 32);
    const icon = day.weather?.[0]?.icon ?? "01d";
    const desc = capitalize(day.weather?.[0]?.description ?? "");

    card.innerHTML = `
      <h4>${dayName}</h4>
      <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" />
      <p>${tempDay}${tempUnit}</p>
      <p>${desc}</p>
    `;
    forecastEl.appendChild(card);
  });
}

function forecastToSpeech(w) {
  return `Forecast for ${w.name}. ${capitalize(w.description)}. Temperature ${w.temp} degrees, feels like ${w.feels}.`;
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.pitch = 0.7;
  utter.rate = 1.0;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /male|en-US|latino|spanish/i.test(v.name)) || voices[0];
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function playMusicFor(w) {
  let src = "Songs/I Know You Want Me - PitBull Snippet.m4a"; // default
  if (w.main.includes("rain")) src = "Songs/Rain Over Me - PitBull Snippet.m4a";
  else if (w.main.includes("snow")) src = "Songs/Time of our Lives - PitBull Snippet.m4a";
  else if (w.main.includes("clear")) src = "Songs/Fireball - PitBull Snippet.m4a";
  else if (w.main.includes("cloud")) src = "Songs/Don't Stop the Party - PitBull Snippet.m4a";
  else if (w.main.includes("thunder")) src = "Songs/Timber - PitBull Snippet.m4a";
  else if (w.main.includes("mist") || w.main.includes("fog")) src = "Songs/I Know You Want Me - PitBull Snippet.m4a";

  music.src = src;
  music.play().catch(() => {});
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

speechSynthesis.onvoiceschanged = () => {};

// Temperature toggle functionality
const tempToggle = document.getElementById('temp-toggle');
tempToggle.addEventListener('click', function() {
  isCelsius = !isCelsius;
  this.textContent = isCelsius ? '°C' : '°F';

  // Re-render if we have forecast data
  if (latestForecast && latestDailyForecast) {
    render(latestForecast, latestDailyForecast);
  }
});

//buttons on sidebar
document.getElementById('homeBtn').onclick = function () {
  window.location.href = 'home.html';  // Link to home page
};

document.getElementById('bioBtn').onclick = function () {
  window.location.href = 'biography.html';  // Link to biography page
};

document.getElementById('songsBtn').onclick = function () {
  window.location.href = 'songs.html';  // Link to songs page
};

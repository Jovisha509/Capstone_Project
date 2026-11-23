let devices = [];
let temperatureChart = null;
let refreshTimer = null;
let isRefreshing = false;
let temperatureHistory = [];
const API_URL = "/api";

document.addEventListener("DOMContentLoaded", () => {
  const lastUpdated = document.getElementById("lastUpdated");
  if (lastUpdated) lastUpdated.textContent = "Connecting to server...";
  document.getElementById("searchInput").addEventListener("input", renderDevices);
  document.getElementById("statusFilter").addEventListener("change", renderDevices);
  initializeChart();
  loadDevices();
  refreshTimer = setInterval(() => refreshDashboard(true), 10000);
});

function initializeChart() {
  const canvas = document.getElementById("temperatureChart");
  if (!canvas || typeof Chart === "undefined") return;
  temperatureChart = new Chart(canvas, {
    type: "line",
    data: { labels: [], datasets: [{
      label: "Temperature °C", data: [], borderColor: "#4169e1",
      backgroundColor: "rgba(65,105,225,.10)", borderWidth: 2,
      fill: true, tension: .35, pointRadius: 3, pointHoverRadius: 5
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, suggestedMin: 15, suggestedMax: 45,
          grid: { color: "#eef1f6" }, ticks: { color: "#96a1b1", font: { size: 9 } }},
        x: { grid: { display: false }, ticks: { color: "#96a1b1", font: { size: 9 }}}
      }
    }
  });
}

async function loadDevices() {
  try {
    const response = await fetch(`${API_URL}/devices`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    devices = await response.json();
    recordTemperatureSnapshot();
    updateDashboard();
    showMessage("Device data loaded successfully.");
  } catch (error) {
    console.error("Initial loading failed:", error);
    showMessage("Unable to connect to Flask server.", true);
  }
}

async function refreshDashboard(isAutomatic = false) {
  if (isRefreshing) return;
  isRefreshing = true;
  const button = document.getElementById("refreshButton");
  if (!isAutomatic) {
    button.disabled = true;
    button.innerHTML = "↻ <span>Refreshing...</span>";
  }
  try {
    const response = await fetch(`${API_URL}/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store"
    });
    if (!response.ok) throw new Error(`Refresh failed: HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.devices)) throw new Error("Invalid refresh response");
    devices = result.devices;
    recordTemperatureSnapshot();
    updateDashboard();
    showMessage(isAutomatic ? "Automatic sensor update successful." : "Sensor readings refreshed successfully.");
  } catch (error) {
    console.error("Dashboard refresh error:", error);
    showMessage("Unable to refresh readings: " + error.message, true);
  } finally {
    isRefreshing = false;
    button.disabled = false;
    button.innerHTML = "↻ <span>Refresh readings</span>";
  }
}

function recordTemperatureSnapshot() {
  const online = devices.filter(d => d.status === "Online");
  if (!online.length) return;
  const average = online.reduce((sum, d) => sum + Number(d.temperature || 0), 0) / online.length;
  temperatureHistory.push({ label: new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}), value: Number(average.toFixed(1)) });
  if (temperatureHistory.length > 12) temperatureHistory.shift();
}

function updateDashboard() {
  updateStatistics();
  renderDevices();
  updateAvailability();
  updateChart();
  updateAlerts();
  updateTimestamp();
  document.getElementById("navDeviceCount").textContent = devices.length;
}

function updateStatistics() {
  const total = devices.length;
  const onlineDevices = devices.filter(d => d.status === "Online");
  const online = onlineDevices.length;
  const offline = total - online;
  const average = online ? onlineDevices.reduce((sum, d) => sum + Number(d.temperature || 0), 0) / online : 0;
  document.getElementById("totalDevices").textContent = total;
  document.getElementById("onlineDevices").textContent = online;
  document.getElementById("offlineDevices").textContent = offline;
  document.getElementById("averageTemperature").textContent = `${average.toFixed(1)}°C`;
}

function renderDevices() {
  const table = document.getElementById("deviceTable");
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const filtered = devices.filter(device => {
    const matchesSearch = [device.id, device.name, device.location].some(v => String(v || "").toLowerCase().includes(search));
    return matchesSearch && (status === "all" || device.status === status);
  });
  table.innerHTML = "";
  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="6" class="empty-state">No matching devices found.</td></tr>';
  }
  filtered.forEach(device => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.innerHTML = `<div class="device-id">${escapeHTML(device.id)}</div><div class="device-name">${escapeHTML(device.name)}</div>`;
    const locationCell = document.createElement("td");
    locationCell.textContent = device.location || "N/A";
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-badge ${device.status === "Online" ? "status-online" : "status-offline"}`;
    badge.textContent = device.status || "Unknown";
    statusCell.appendChild(badge);
    const tempCell = document.createElement("td");
    tempCell.className = `reading ${Number(device.temperature) >= 40 ? "warning" : ""}`;
    tempCell.textContent = `${Number(device.temperature).toFixed(1)} °C`;
    const humidityCell = document.createElement("td");
    humidityCell.className = `reading ${Number(device.humidity) >= 80 ? "warning" : ""}`;
    humidityCell.textContent = `${Number(device.humidity).toFixed(1)} %`;
    const updatedCell = document.createElement("td");
    updatedCell.textContent = device.last_updated ? new Date(device.last_updated).toLocaleTimeString() : "—";
    [nameCell, locationCell, statusCell, tempCell, humidityCell, updatedCell].forEach(cell => row.appendChild(cell));
    table.appendChild(row);
  });
  document.getElementById("deviceCount").textContent = `Showing ${filtered.length} of ${devices.length} devices`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}

function updateAvailability() {
  const total = devices.length;
  const online = devices.filter(d => d.status === "Online").length;
  const offline = total - online;
  const percentage = total ? Math.round(online / total * 100) : 0;
  document.getElementById("healthPercent").textContent = `${percentage}%`;
  document.getElementById("legendOnline").textContent = online;
  document.getElementById("legendOffline").textContent = offline;
  const degrees = percentage * 3.6;
  document.getElementById("healthCircle").style.background =
    `conic-gradient(#159b70 0deg ${degrees}deg, #e45b65 ${degrees}deg 360deg)`;
}

function updateChart() {
  if (!temperatureChart) return;
  temperatureChart.data.labels = temperatureHistory.map(item => item.label);
  temperatureChart.data.datasets[0].data = temperatureHistory.map(item => item.value);
  temperatureChart.update();
}

function updateAlerts() {
  const alerts = [];
  devices.forEach(device => {
    if (device.status === "Offline") alerts.push({ title: `${device.name} is offline`, detail: `${device.id} · ${device.location}`, symbol: "!" });
    if (device.status === "Online" && Number(device.temperature) >= 40) alerts.push({ title: `High temperature on ${device.name}`, detail: `${device.id} · ${Number(device.temperature).toFixed(1)} °C`, symbol: "♨" });
    if (device.status === "Online" && Number(device.humidity) >= 80) alerts.push({ title: `High humidity on ${device.name}`, detail: `${device.id} · ${Number(device.humidity).toFixed(1)}%`, symbol: "!" });
  });
  document.getElementById("alertCount").textContent = `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`;
  const list = document.getElementById("alertsList");
  list.innerHTML = alerts.length ? "" : '<div class="no-alerts">✓ All monitored readings are within the configured demo thresholds.</div>';
  alerts.forEach(alert => {
    const item = document.createElement("div");
    item.className = "alert-row";
    const symbol = document.createElement("span");
    symbol.className = "alert-symbol";
    symbol.textContent = alert.symbol;
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = alert.title;
    const detail = document.createElement("small");
    detail.textContent = alert.detail;
    text.append(title, detail);
    item.append(symbol, text);
    list.appendChild(item);
  });
}

function updateTimestamp() {
  document.getElementById("lastUpdated").textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

function showMessage(message, isError = false) {
  const element = document.getElementById("message");
  element.textContent = message;
  element.className = isError ? "message error" : "message";
}
window.refreshDashboard = refreshDashboard;

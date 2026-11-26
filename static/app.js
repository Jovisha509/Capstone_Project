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


// ---------- S3 HISTORICAL DATA ----------
let s3HistoryChart = null;
let currentS3Readings = [];

document.addEventListener("DOMContentLoaded", () => {
  addS3HistoryPanel();
  // Populate the device selector after the existing app has loaded devices.
  setTimeout(populateS3HistoryDevices, 1200);
});

function addS3HistoryPanel() {
  if (document.getElementById("s3HistoryPanel")) return;
  const section = document.createElement("section");
  section.id = "s3HistoryPanel";
  section.className = "section-block panel";
  section.innerHTML = `
    <div class="history-header">
      <div class="history-title-group">
        <span class="section-kicker">DATA ARCHIVE · AMAZON S3</span>
        <h2>Historical Sensor Data</h2>
        <p>Explore, compare and export previously recorded device telemetry.</p>
      </div>
      <div class="history-storage-pill"><span></span> Persistent cloud storage</div>
    </div>
    <div class="history-filter-bar">
      <label class="history-field history-device-field"><span>DEVICE</span><select id="s3HistoryDevice"></select></label>
      <label class="history-field"><span>START DATE</span><input type="date" id="s3HistoryStart"></label>
      <label class="history-field"><span>END DATE</span><input type="date" id="s3HistoryEnd"></label>
      <button class="history-load-button" id="s3HistoryLoad" type="button"><span>↻</span> Load history</button>
    </div>
    <div class="history-summary-row">
      <div class="history-summary-card"><span class="history-summary-icon">▤</span><div><small>READINGS FOUND</small><strong id="s3HistoryCount">0</strong></div></div>
      <div class="history-summary-card"><span class="history-summary-icon">◷</span><div><small>SELECTED PERIOD</small><strong id="s3HistoryPeriod">Last 7 days</strong></div></div>
      <div class="history-summary-card"><span class="history-summary-icon">☁</span><div><small>DATA SOURCE</small><strong>Amazon S3</strong></div></div>
    </div>
    <div class="history-chart-card">
      <div class="history-subheading"><div><h3>Temperature trend</h3><p>Historical temperature readings over the selected period</p></div><span class="history-unit">°C</span></div>
      <div class="chart-container history-chart"><canvas id="s3HistoryCanvas"></canvas></div>
    </div>
    <div class="history-table-heading"><div><h3>Recorded readings</h3><p>Detailed sensor values retrieved from the archive</p></div><button class="history-export-button" id="s3HistoryCsv" type="button" disabled>↓ Export CSV</button></div>
    <div id="s3HistoryMessage" class="history-message">Choose a device and date range, then load the archived readings.</div>
    <div class="table-wrapper history-table-wrap"><table><thead><tr><th>TIMESTAMP</th><th>DEVICE</th><th>TEMPERATURE</th><th>HUMIDITY</th><th>PRESSURE</th><th>VIBRATION</th></tr></thead>
    <tbody id="s3HistoryRows"><tr><td colspan="6" class="empty-state">No history loaded yet.</td></tr></tbody></table></div>`;
  const inventory = document.querySelector(".device-panel");
  const inventorySection = inventory?.closest(".section-block") || inventory;
  if (inventorySection) inventorySection.insertAdjacentElement("afterend", section);
  else document.querySelector(".main-content")?.appendChild(section);

  const now = new Date(), from = new Date();
  from.setDate(now.getDate() - 6);
  document.getElementById("s3HistoryEnd").value = historyDateValue(now);
  document.getElementById("s3HistoryStart").value = historyDateValue(from);
  document.getElementById("s3HistoryLoad").addEventListener("click", loadS3History);
  document.getElementById("s3HistoryStart").addEventListener("change", updateHistoryPeriod);
  document.getElementById("s3HistoryEnd").addEventListener("change", updateHistoryPeriod);
  updateHistoryPeriod();
  document.getElementById("s3HistoryCsv").addEventListener("click", exportS3History);
}
function updateHistoryPeriod() {
  const start = document.getElementById("s3HistoryStart")?.value;
  const end = document.getElementById("s3HistoryEnd")?.value;
  const output = document.getElementById("s3HistoryPeriod");
  if (output && start && end) output.textContent = `${start} → ${end}`;
}
function historyDateValue(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function populateS3HistoryDevices() {
  const select = document.getElementById("s3HistoryDevice");
  if (!select || !Array.isArray(devices)) return;
  const previous = select.value;
  select.innerHTML = "";
  devices.forEach(d => {
    const option = document.createElement("option");
    option.value = d.id; option.textContent = `${d.id} – ${d.name}`;
    select.appendChild(option);
  });
  if (previous) select.value = previous;
}
async function loadS3History() {
  const device = document.getElementById("s3HistoryDevice").value;
  const start = document.getElementById("s3HistoryStart").value;
  const end = document.getElementById("s3HistoryEnd").value;
  const msg = document.getElementById("s3HistoryMessage");
  if (start > end) { msg.textContent = "Start date must be on or before end date."; msg.className = "message error"; return; }
  msg.textContent = "Loading readings from S3…"; msg.className = "history-message is-loading";
  const loadButton = document.getElementById("s3HistoryLoad");
  loadButton.disabled = true; loadButton.innerHTML = "Loading…";
  updateHistoryPeriod();
  const q = new URLSearchParams({device_id: device, start_date: start, end_date: end, limit: "1000"});
  try {
    const response = await fetch(`/api/history?${q}`, {cache: "no-store"});
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
    currentS3Readings = result.readings || [];
    renderS3History(currentS3Readings);
    msg.textContent = `${result.count} reading(s) retrieved successfully from Amazon S3.`;
    msg.className = "history-message is-success";
  } catch (err) {
    msg.textContent = `Could not load S3 history: ${err.message}`;
    msg.className = "history-message is-error";
  } finally {
    loadButton.disabled = false; loadButton.innerHTML = "↻ Load history";
  }
}
function renderS3History(rows) {
  const tbody = document.getElementById("s3HistoryRows");
  tbody.innerHTML = "";
  if (!rows.length) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No readings found for this device/date range.</td></tr>';
  rows.forEach(r => {
    const tr = document.createElement("tr");
    [r.timestamp ? new Date(r.timestamp).toLocaleString() : "—", r.device_id || "—",
     r.temperature ?? "—", r.humidity ?? "—", r.pressure ?? "—", r.vibration ?? "—"].forEach(v => {
      const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  document.getElementById("s3HistoryCount").textContent = rows.length.toLocaleString();
  document.getElementById("s3HistoryCsv").disabled = !rows.length;
  const canvas = document.getElementById("s3HistoryCanvas");
  if (typeof Chart !== "undefined" && canvas) {
    if (s3HistoryChart) s3HistoryChart.destroy();
    s3HistoryChart = new Chart(canvas, {
      type: "line",
      data: {labels: rows.map(r => r.timestamp ? new Date(r.timestamp).toLocaleString() : ""),
        datasets: [{label:"Temperature °C", data:rows.map(r => r.temperature == null ? null : Number(r.temperature)),
          borderColor:"#4169e1", backgroundColor:"rgba(65,105,225,.10)", fill:true, tension:.3, spanGaps:true}]},
      options: {responsive:true, maintainAspectRatio:false, interaction:{intersect:false,mode:"index"},
        scales:{x:{ticks:{maxTicksLimit:8}}}}
    });
  }
}
function exportS3History() {
  if (!currentS3Readings.length) return;
  const cols = ["timestamp","device_id","device_name","location","temperature","humidity","pressure","vibration","status","s3_key"];
  const quote = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const csv = [cols.join(","), ...currentS3Readings.map(r => cols.map(c => quote(r[c])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a"); a.href=url; a.download="iot-s3-history.csv"; a.click(); URL.revokeObjectURL(url);
}


let devices = [];
let temperatureChart = null;
let refreshTimer = null;
let isRefreshing = false;

const API_URL = "/api";

// Display the date
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("lastUpdated").textContent =
        "Connecting to server...";

    document.getElementById("searchInput").addEventListener(
        "input",
        renderDevices
    );

    initializeChart();
    loadDevices();

    // Automatically generate and fetch new readings every 10 seconds
    refreshTimer = setInterval(() => {
        refreshDashboard(true);
    }, 10000);
});


// Initialize temperature chart
function initializeChart() {
    const canvas = document.getElementById("temperatureChart");

    if (!canvas || typeof Chart === "undefined") {
        console.warn("Chart.js is unavailable.");
        return;
    }

    temperatureChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Temperature °C",
                data: [],
                borderColor: "#315bd6",
                backgroundColor: "rgba(49, 91, 214, 0.10)",
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "#edf0f5"
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}


// Load existing device readings
async function loadDevices() {
    try {
        const response = await fetch(`${API_URL}/devices`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        devices = await response.json();

        updateDashboard();

        showMessage("Device data loaded successfully.");

    } catch (error) {
        console.error("Initial loading failed:", error);
        showMessage("Unable to connect to Flask server.", true);
    }
}


// Refresh button: ask backend to generate new readings
async function refreshDashboard(isAutomatic = false) {

    if (isRefreshing) return;

    isRefreshing = true;

    const button = document.getElementById("refreshButton");

    if (!isAutomatic) {
        button.disabled = true;
        button.textContent = "Refreshing...";
    }

    try {

        const response = await fetch(`${API_URL}/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Refresh failed: HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.devices)) {
            throw new Error("Invalid refresh response");
        }

        devices = result.devices;

        updateDashboard();

        showMessage(
            isAutomatic
                ? "Automatic sensor update successful."
                : "Sensor readings refreshed successfully."
        );

        console.log("Updated device readings:", devices);

    } catch (error) {

        console.error("Dashboard refresh error:", error);

        showMessage("Unable to refresh readings: " + error.message, true);

    } finally {

        isRefreshing = false;

        button.disabled = false;
        button.textContent = "↻ Refresh readings";
    }
}


// Update all dashboard components
function updateDashboard() {
    updateStatistics();
    renderDevices();
    updateAvailability();
    updateChart();
    updateTimestamp();
}


// Update summary cards
function updateStatistics() {

    const total = devices.length;

    const online = devices.filter(
        device => device.status === "Online"
    ).length;

    const offline = total - online;

    const onlineDevices = devices.filter(
        device => device.status === "Online"
    );

    const average = onlineDevices.length
        ? onlineDevices.reduce(
            (sum, device) => sum + Number(device.temperature || 0),
            0
        ) / onlineDevices.length
        : 0;

    document.getElementById("totalDevices").textContent = total;

    document.getElementById("onlineDevices").textContent = online;

    document.getElementById("offlineDevices").textContent = offline;

    document.getElementById("averageTemperature").textContent =
        average.toFixed(1) + "°C";
}


// Update device table
function renderDevices() {

    const table = document.getElementById("deviceTable");

    const search = document.getElementById("searchInput")
        .value.trim().toLowerCase();

    const filtered = devices.filter(device =>
        String(device.id || "").toLowerCase().includes(search) ||
        String(device.name || "").toLowerCase().includes(search)
    );

    table.innerHTML = "";

    if (filtered.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No matching devices found
                </td>
            </tr>
        `;
    }

    filtered.forEach(device => {

        const row = document.createElement("tr");

        const statusClass = device.status === "Online"
            ? "status-online"
            : "status-offline";

        const nameCell = document.createElement("td");
        nameCell.innerHTML = `
            <div class="device-id">${escapeHTML(device.id)}</div>
            <div class="device-name">${escapeHTML(device.name)}</div>
        `;

        const locationCell = document.createElement("td");
        locationCell.textContent = device.location || "N/A";

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `status-badge ${statusClass}`;
        badge.textContent = device.status;
        statusCell.appendChild(badge);

        const temperatureCell = document.createElement("td");
        temperatureCell.textContent =
            `${Number(device.temperature).toFixed(1)} °C`;

        const humidityCell = document.createElement("td");
        humidityCell.textContent =
            `${Number(device.humidity).toFixed(1)} %`;

        const updatedCell = document.createElement("td");
        updatedCell.textContent = device.last_updated
            ? new Date(device.last_updated).toLocaleTimeString()
            : "N/A";

        [
            nameCell,
            locationCell,
            statusCell,
            temperatureCell,
            humidityCell,
            updatedCell
        ].forEach(cell => row.appendChild(cell));

        table.appendChild(row);
    });

    document.getElementById("deviceCount").textContent =
        `Showing ${filtered.length} of ${devices.length} devices`;
}


// Safely display text in the device name and ID
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// Update online/offline donut
function updateAvailability() {

    const total = devices.length;

    const online = devices.filter(
        device => device.status === "Online"
    ).length;

    const offline = total - online;

    const percentage = total
        ? Math.round((online / total) * 100)
        : 0;

    document.getElementById("healthPercent").textContent =
        percentage + "%";

    document.getElementById("legendOnline").textContent = online;

    document.getElementById("legendOffline").textContent = offline;

    const onlineDegrees = percentage * 3.6;

    document.getElementById("healthCircle").style.background =
        `conic-gradient(#16a36c 0deg ${onlineDegrees}deg,
        #e45b65 ${onlineDegrees}deg 360deg)`;
}


// Update temperature chart
function updateChart() {

    if (!temperatureChart) return;

    const onlineDevices = devices.filter(
        device => device.status === "Online"
    );

    temperatureChart.data.labels = onlineDevices.map(
        device => device.id
    );

    temperatureChart.data.datasets[0].data = onlineDevices.map(
        device => Number(device.temperature)
    );

    temperatureChart.update();
}


// Update timestamp
function updateTimestamp() {

    document.getElementById("lastUpdated").textContent =
        "Last updated: " + new Date().toLocaleTimeString();
}


// Display messages
function showMessage(message, isError = false) {

    const element = document.getElementById("message");

    element.textContent = message;

    element.className = isError ? "message error" : "message";
}


// Make function accessible to the HTML button
window.refreshDashboard = refreshDashboard;

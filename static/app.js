
let devices = [];
let temperatureChart;
let temperatureHistory = [];

document.getElementById("currentDate").textContent =
    new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

function initializeChart() {
    const ctx = document.getElementById("temperatureChart");

    temperatureChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Temperature °C",
                data: [],
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.10)",
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                borderWidth: 2
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
                    beginAtZero: false,
                    grid: {
                        color: "#edf1f7"
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

function renderDevices() {
    const table = document.getElementById("deviceTable");
    const search = document.getElementById("searchInput")
        .value.toLowerCase();

    const filtered = devices.filter(device =>
        String(device.id || "").toLowerCase().includes(search) ||
        String(device.name || "").toLowerCase().includes(search) ||
        String(device.location || "Not specified")
            .toLowerCase().includes(search)
    );

    table.innerHTML = "";

    if (filtered.length === 0) {
        table.innerHTML =
            '<tr><td colspan="6">No devices found</td></tr>';
    }

    filtered.forEach(device => {
        const status = String(device.status || "Offline");
        const statusClass =
            status.toLowerCase() === "online"
                ? "status-online"
                : "status-offline";

        table.innerHTML += `
            <tr>
                <td class="device-id">${device.id}</td>
                <td>${device.name || "Unknown"}</td>
                <td>${device.location || "Not specified"}</td>
                <td>${device.temperature ?? "--"} °C</td>
                <td>${device.humidity ?? "--"}%</td>
                <td>
                    <span class="status ${statusClass}">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    });

    document.getElementById("deviceCount").textContent =
        `Showing ${filtered.length} of ${devices.length} devices`;
}

function updateStatistics(devices) {

    const total = devices.length;

    const online = devices.filter(
        device => device.status === "Online"
    ).length;

    const offline = total - online;

    const averageTemperature = online > 0
        ? devices
            .filter(device => device.status === "Online")
            .reduce((sum, device) => sum + Number(device.temperature), 0) / online
        : 0;

    document.getElementById("totalDevices").textContent = total;
    document.getElementById("onlineDevices").textContent = online;
    document.getElementById("offlineDevices").textContent = offline;
    document.getElementById("averageTemperature").textContent =
        averageTemperature.toFixed(1) + "°C";

    document.getElementById("healthPercent").textContent =
        total > 0 ? Math.round((online / total) * 100) + "%" : "0%";

    document.getElementById("legendOnline").textContent = online;
    document.getElementById("legendOffline").textContent = offline;
}

async function refreshDashboard() {
    try {
        const response = await fetch("/api/devices", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Unable to fetch device details");
        }

        devices = await response.json();

        updateStatistics();
        renderDevices();

    } catch (error) {
        console.error("Refresh failed:", error);
    }
}

window.refreshDashboard = refreshDashboard;

document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    setInterval(refreshDashboard, 5000);
});

initializeChart();
refreshDashboard();

// Automatically refresh every 5 seconds.
setInterval(refreshDashboard, 5000);

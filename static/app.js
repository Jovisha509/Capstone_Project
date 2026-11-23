
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

async function refreshDashboard() {
    try {
        const response = await fetch("/api/devices");

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        devices = await response.json();

        const onlineDevices = devices.filter(
            device => String(device.status).toLowerCase() === "online"
        );

        const offlineDevices = devices.length - onlineDevices.length;

        const temperatures = onlineDevices
            .map(device => Number(device.temperature))
            .filter(value => Number.isFinite(value));

        const averageTemperature = temperatures.length
            ? (
                temperatures.reduce((sum, value) => sum + value, 0) /
                temperatures.length
              ).toFixed(1)
            : "0.0";

        document.getElementById("totalDevices").textContent =
            devices.length;

        document.getElementById("onlineDevices").textContent =
            onlineDevices.length;

        document.getElementById("offlineDevices").textContent =
            offlineDevices;

        document.getElementById("averageTemperature").textContent =
            averageTemperature;

        document.getElementById("legendOnline").textContent =
            onlineDevices.length;

        document.getElementById("legendOffline").textContent =
            offlineDevices;

        const percentage = devices.length
            ? Math.round((onlineDevices.length / devices.length) * 100)
            : 0;

        document.getElementById("healthPercent").textContent =
            percentage + "%";

        document.getElementById("healthCircle").style.background =
            `conic-gradient(#16a34a ${percentage}%, #e9eef5 ${percentage}%)`;

        renderDevices();

        // Keep a short history of average temperatures in this browser.
        temperatureHistory.push({
            time: new Date().toLocaleTimeString("en-IN"),
            temperature: Number(averageTemperature)
        });

        if (temperatureHistory.length > 10) {
            temperatureHistory.shift();
        }

        if (temperatureChart) {
            temperatureChart.data.labels =
                temperatureHistory.map(item => item.time);

            temperatureChart.data.datasets[0].data =
                temperatureHistory.map(item => item.temperature);

            temperatureChart.update();
        }

        console.log("Dashboard updated successfully", devices);

    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

initializeChart();
refreshDashboard();

// Automatically refresh every 5 seconds.
setInterval(refreshDashboard, 5000);

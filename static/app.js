
let devices = [];
let temperatureChart;

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
        device.id.toLowerCase().includes(search) ||
        device.name.toLowerCase().includes(search) ||
        device.location.toLowerCase().includes(search)
    );

    table.innerHTML = "";

    if (filtered.length === 0) {
        table.innerHTML =
            '<tr><td colspan="6">No devices found</td></tr>';
    }

    filtered.forEach(device => {
        const statusClass =
            device.status === "Online"
                ? "status-online"
                : "status-offline";

        table.innerHTML += `
            <tr>
                <td class="device-id">${device.id}</td>
                <td>${device.name}</td>
                <td>${device.location}</td>
                <td>${device.temperature} °C</td>
                <td>${device.humidity}%</td>
                <td>
                    <span class="status ${statusClass}">
                        ${device.status}
                    </span>
                </td>
            </tr>
        `;
    });

    document.getElementById("deviceCount").textContent =
        `Showing ${filtered.length} of ${devices.length} devices`;
}


async function refreshDashboard(simulate = false) {
    try {
        if (simulate) {
            await fetch("/api/simulate", {
                method: "POST"
            });
        }

        const response = await fetch("/api/overview");

        if (!response.ok) {
            throw new Error("Unable to load dashboard data");
        }

        const data = await response.json();

        devices = data.devices;

        document.getElementById("totalDevices").textContent =
            data.total;

        document.getElementById("onlineDevices").textContent =
            data.online;

        document.getElementById("offlineDevices").textContent =
            data.offline;

        document.getElementById("averageTemperature").textContent =
            data.average_temperature;

        document.getElementById("legendOnline").textContent =
            data.online;

        document.getElementById("legendOffline").textContent =
            data.offline;

        const percentage = data.total
            ? Math.round((data.online / data.total) * 100)
            : 0;

        document.getElementById("healthPercent").textContent =
            percentage + "%";

        document.getElementById("healthCircle").style.background =
            `conic-gradient(#16a34a ${percentage}%, #e9eef5 ${percentage}%)`;

        renderDevices();

        if (temperatureChart) {
            temperatureChart.data.labels =
                data.history.map(item => item.time);

            temperatureChart.data.datasets[0].data =
                data.history.map(item => item.temperature);

            temperatureChart.update();
        }

    } catch (error) {
        console.error("Dashboard error:", error);
    }
}


initializeChart();
refreshDashboard();

// Automatically refresh dashboard every 5 seconds
setInterval(refreshDashboard, 5000);

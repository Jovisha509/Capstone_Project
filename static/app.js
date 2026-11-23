
let devices = [];

// Display current date
document.getElementById("currentDate").textContent =
    new Date().toLocaleString();

// Update dashboard statistics
function updateStatistics() {

    const total = devices.length;

    const online = devices.filter(
        device => device.status === "Online"
    ).length;

    const offline = total - online;

    const onlineDevices = devices.filter(
        device => device.status === "Online"
    );

    const averageTemperature = onlineDevices.length > 0
        ? onlineDevices.reduce(
            (sum, device) => sum + Number(device.temperature || 0),
            0
        ) / onlineDevices.length
        : 0;

    document.getElementById("totalDevices").textContent = total;

    document.getElementById("onlineDevices").textContent = online;

    document.getElementById("offlineDevices").textContent = offline;

    document.getElementById("averageTemperature").textContent =
        averageTemperature.toFixed(1) + "°C";
}


// Display device details in the table
function renderDevices() {

    const table = document.getElementById("deviceTable");

    const searchValue = document.getElementById("searchInput")
        .value.toLowerCase();

    const filteredDevices = devices.filter(device => {

        return (
            String(device.id || "").toLowerCase().includes(searchValue) ||
            String(device.name || "").toLowerCase().includes(searchValue)
        );

    });

    table.innerHTML = "";

    if (filteredDevices.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5">No devices found</td>
            </tr>
        `;

    } else {

        filteredDevices.forEach(device => {

            const statusClass =
                device.status === "Online" ? "online" : "offline";

            const row = document.createElement("tr");

            const values = [
                device.id,
                device.name,
                device.status,
                `${device.temperature}°C`,
                `${device.humidity}%`
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");

                // Use textContent to safely display device data
                cell.textContent = value ?? "N/A";

                if (index === 2) {
                    cell.className = statusClass;
                }

                row.appendChild(cell);
            });

            table.appendChild(row);

        });

    }

    document.getElementById("deviceCount").textContent =
        `Showing ${filteredDevices.length} of ${devices.length} devices`;
}


// Fetch device details from Flask API
async function refreshDashboard() {

    const message = document.getElementById("message");

    try {

        message.textContent = "Refreshing device details...";

        const response = await fetch("/api/devices", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid device data received");
        }

        devices = data;

        console.log("Latest device data:", devices);

        updateStatistics();

        renderDevices();

        message.textContent = "Device details updated successfully.";

    } catch (error) {

        console.error("Refresh failed:", error);

        message.textContent =
            "Unable to load device details. Check the API and console.";
    }

}


// Search devices
document.getElementById("searchInput").addEventListener(
    "input",
    renderDevices
);


// Make refresh function accessible to HTML button
window.refreshDashboard = refreshDashboard;


// Load data when the page opens
document.addEventListener("DOMContentLoaded", () => {

    refreshDashboard();

    // Automatically refresh every 5 seconds
    setInterval(refreshDashboard, 5000);

});


from flask import Flask, render_template, jsonify, request
from datetime import datetime
import random

app = Flask(__name__)

devices = [
    {
        "id": "IOT-001",
        "name": "Temperature Sensor",
        "location": "Production Floor",
        "temperature": 28.5,
        "humidity": 65,
        "status": "Online"
    },
    {
        "id": "IOT-002",
        "name": "Pressure Sensor",
        "location": "Assembly Unit",
        "temperature": 32.1,
        "humidity": 58,
        "status": "Online"
    },
    {
        "id": "IOT-003",
        "name": "Vibration Sensor",
        "location": "Machine Room",
        "temperature": 35.4,
        "humidity": 60,
        "status": "Offline"
    },
    {
        "id": "IOT-004",
        "name": "Humidity Sensor",
        "location": "Storage Area",
        "temperature": 26.8,
        "humidity": 72,
        "status": "Online"
    },
    {
        "id": "IOT-005",
        "name": "Smart Gateway",
        "location": "Control Room",
        "temperature": 29.2,
        "humidity": 55,
        "status": "Online"
    }
]

history = []


def add_history():
    online_devices = [
        d for d in devices if d["status"] == "Online"
    ]

    if online_devices:
        avg_temp = round(
            sum(d["temperature"] for d in online_devices)
            / len(online_devices), 1
        )
    else:
        avg_temp = 0

    history.append({
        "time": datetime.now().strftime("%H:%M:%S"),
        "temperature": avg_temp
    })

    if len(history) > 20:
        history.pop(0)


# Initial chart data
for _ in range(10):
    add_history()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "application": "IoT Monitoring Dashboard"
    })


@app.route("/api/overview")
def overview():

    online = sum(
        1 for d in devices if d["status"] == "Online"
    )

    offline = len(devices) - online

    online_devices = [
        d for d in devices if d["status"] == "Online"
    ]

    avg_temp = round(
        sum(d["temperature"] for d in online_devices)
        / len(online_devices), 1
    ) if online_devices else 0

    return jsonify({
        "total": len(devices),
        "online": online,
        "offline": offline,
        "average_temperature": avg_temp,
        "devices": devices,
        "history": history
    })


@app.route("/api/devices")
def get_devices():
    return jsonify(devices)


@app.route("/api/update", methods=["POST"])
def update_device():

    data = request.get_json(silent=True) or {}

    device_id = data.get("id")
    status = data.get("status")

    if status not in ["Online", "Offline"]:
        return jsonify({"error": "Invalid status"}), 400

    for device in devices:
        if device["id"] == device_id:
            device["status"] = status
            return jsonify({
                "message": "Device updated",
                "device": device
            })

    return jsonify({"error": "Device not found"}), 404


@app.route("/api/sensor", methods=["POST"])
def receive_sensor_data():

    data = request.get_json(silent=True) or {}

    device_id = data.get("id")
    temperature = data.get("temperature")
    humidity = data.get("humidity")

    if not device_id or temperature is None or humidity is None:
        return jsonify({"error": "Missing sensor data"}), 400

    try:
        temperature = float(temperature)
        humidity = float(humidity)
    except (ValueError, TypeError):
        return jsonify({"error": "Sensor values must be numeric"}), 400

    if not -50 <= temperature <= 150:
        return jsonify({"error": "Invalid temperature"}), 400

    if not 0 <= humidity <= 100:
        return jsonify({"error": "Invalid humidity"}), 400

    for device in devices:
        if device["id"] == device_id:
            device["temperature"] = temperature
            device["humidity"] = humidity
            device["status"] = "Online"

            add_history()

            return jsonify({
                "message": "Sensor data received successfully",
                "device": device
            })

    return jsonify({"error": "Device not found"}), 404


@app.route("/api/simulate", methods=["POST"])
def simulate_data():

    for device in devices:
        if device["status"] == "Online":
            device["temperature"] = round(
                random.uniform(24, 38), 1
            )
            device["humidity"] = random.randint(45, 80)

    add_history()

    return jsonify({"message": "Sensor data refreshed"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

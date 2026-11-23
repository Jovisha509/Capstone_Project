
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Sample IoT device data
devices = [
    {
        "id": "IOT-001",
        "name": "Temperature Sensor",
        "status": "Online",
        "temperature": 28.5,
        "humidity": 60
    },
    {
        "id": "IOT-002",
        "name": "Pressure Sensor",
        "status": "Online",
        "temperature": 30.0,
        "humidity": 55
    },
    {
        "id": "IOT-003",
        "name": "Vibration Sensor",
        "status": "Offline",
        "temperature": 32.0,
        "humidity": 50
    },
    {
        "id": "IOT-004",
        "name": "Humidity Sensor",
        "status": "Online",
        "temperature": 27.0,
        "humidity": 65
    },
    {
        "id": "IOT-005",
        "name": "Smart Gateway",
        "status": "Online",
        "temperature": 29.0,
        "humidity": 58
    }
]

sensor_history = []


def add_history():
    sensor_history.append({
        "device_count": len(devices),
        "online_devices": sum(
            1 for device in devices
            if device["status"] == "Online"
        ),
        "average_temperature": round(
            sum(d["temperature"] for d in devices) / len(devices), 2
        )
    })


@app.route("/")
def home():
    return render_template("index.html", devices=devices)


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "application": "IoT Monitoring Dashboard"
    }), 200


@app.route("/api/devices", methods=["GET"])
def get_devices():
    return jsonify(devices), 200


@app.route("/api/update", methods=["POST"])
def update_device():
    data = request.get_json(silent=True) or {}

    device_id = data.get("id")
    status = data.get("status")

    if not device_id or status not in ["Online", "Offline"]:
        return jsonify({"error": "Invalid status"}), 400

    for device in devices:
        if device["id"] == device_id:
            device["status"] = status
            return jsonify({
                "message": "Device updated",
                "device": device
            }), 200

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
        return jsonify({
            "error": "Sensor values must be numeric"
        }), 400

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
            }), 200

    return jsonify({"error": "Device not found"}), 404


@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify(sensor_history), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

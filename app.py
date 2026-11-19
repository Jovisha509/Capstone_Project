
from flask import Flask, render_template, jsonify, request
import random
from datetime import datetime

app = Flask(__name__)

devices = [
    {"id": "IOT-001", "temperature": 35, "humidity": 60},
    {"id": "IOT-002", "temperature": 42, "humidity": 55},
    {"id": "IOT-003", "temperature": 30, "humidity": 70}
]


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "UP",
        "application": "IoT Monitoring Application"
    }), 200


@app.route("/api/devices")
def get_devices():
    return jsonify(devices)


@app.route("/api/update", methods=["POST"])
def update_devices():

    for device in devices:
        device["temperature"] = round(
            random.uniform(25, 85), 2
        )

        device["humidity"] = round(
            random.uniform(30, 90), 2
        )

    return jsonify({
        "message": "Sensor readings updated",
        "devices": devices
    })


@app.route("/api/sensor", methods=["POST"])
def receive_sensor_data():

    data = request.get_json(silent=True) or {}

    device_id = data.get("device_id")
    temperature = data.get("temperature")
    humidity = data.get("humidity")

    if not device_id or temperature is None or humidity is None:
        return jsonify({"error": "Missing sensor data"}), 400

    try:
        temperature = float(temperature)
        humidity = float(humidity)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid sensor values"}), 400

    if not -50 <= temperature <= 150:
        return jsonify({"error": "Invalid temperature"}), 400

    if not 0 <= humidity <= 100:
        return jsonify({"error": "Invalid humidity"}), 400

    device = next(
        (d for d in devices if d["id"] == device_id),
        None
    )

    if device is None:
        device = {"id": device_id}
        devices.append(device)

    device["temperature"] = temperature
    device["humidity"] = humidity
    device["last_seen"] = datetime.now().isoformat()

    return jsonify({
        "message": "Sensor data received successfully",
        "device": device
    }), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

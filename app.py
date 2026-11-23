
from flask import Flask, render_template, jsonify, request
from threading import Lock
from datetime import datetime
import random

app = Flask(__name__)

data_lock = Lock()

devices = [
    {
        "id": "IOT-001",
        "name": "Temperature Sensor",
        "location": "Production Unit A",
        "status": "Online",
        "temperature": 28.5,
        "humidity": 60,
        "last_updated": ""
    },
    {
        "id": "IOT-002",
        "name": "Pressure Sensor",
        "location": "Production Unit B",
        "status": "Online",
        "temperature": 30.0,
        "humidity": 55,
        "last_updated": ""
    },
    {
        "id": "IOT-003",
        "name": "Vibration Sensor",
        "location": "Motor Section",
        "status": "Offline",
        "temperature": 32.0,
        "humidity": 50,
        "last_updated": ""
    },
    {
        "id": "IOT-004",
        "name": "Humidity Sensor",
        "location": "Storage Area",
        "status": "Online",
        "temperature": 27.0,
        "humidity": 65,
        "last_updated": ""
    },
    {
        "id": "IOT-005",
        "name": "Smart Gateway",
        "location": "Control Room",
        "status": "Online",
        "temperature": 29.0,
        "humidity": 58,
        "last_updated": ""
    }
]

for device in devices:
    device["last_updated"] = datetime.now().isoformat(timespec="seconds")


def get_devices():
    return [device.copy() for device in devices]


@app.route("/")
def dashboard():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "message": "IoT Dashboard API is running"
    })


@app.route("/api/devices", methods=["GET"])
def get_all_devices():
    with data_lock:
        return jsonify(get_devices())


@app.route("/api/refresh", methods=["POST"])
def refresh_devices():
    """Generate new readings for online demo devices."""

    with data_lock:
        for device in devices:

            if device["status"] == "Offline":
                continue

            device["temperature"] = round(
                max(0, min(100, device["temperature"] +
                           random.uniform(-1.5, 1.5))), 1
            )

            device["humidity"] = round(
                max(0, min(100, device["humidity"] +
                           random.uniform(-3, 3))), 1
            )

            device["last_updated"] = datetime.now().isoformat(
                timespec="seconds"
            )

        return jsonify({
            "success": True,
            "message": "Sensor readings refreshed",
            "devices": get_devices()
        })


@app.route("/api/sensor", methods=["POST"])
def update_sensor():
    """Accept readings from a real or simulated IoT device."""

    data = request.get_json(silent=True) or {}

    device_id = data.get("device_id")
    temperature = data.get("temperature")
    humidity = data.get("humidity")

    if not device_id:
        return jsonify({
            "success": False,
            "message": "device_id is required"
        }), 400

    try:
        temperature = float(temperature)
        humidity = float(humidity)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Temperature and humidity must be numbers"
        }), 400

    if not 0 <= temperature <= 100:
        return jsonify({
            "success": False,
            "message": "Temperature must be between 0 and 100"
        }), 400

    if not 0 <= humidity <= 100:
        return jsonify({
            "success": False,
            "message": "Humidity must be between 0 and 100"
        }), 400

    with data_lock:
        for device in devices:
            if device["id"] == device_id:
                device["temperature"] = round(temperature, 1)
                device["humidity"] = round(humidity, 1)
                device["status"] = "Online"
                device["last_updated"] = datetime.now().isoformat(
                    timespec="seconds"
                )

                return jsonify({
                    "success": True,
                    "message": "Sensor data updated successfully",
                    "device": device.copy()
                })

    return jsonify({
        "success": False,
        "message": "Device not found"
    }), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

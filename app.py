
from flask import Flask, render_template, jsonify, request
from threading import Lock
import random
import boto3
import json
import logging
from datetime import datetime, timezone
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

    readings_to_save = []

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

            readings_to_save.append(device.copy())

        current_devices = get_devices()

    # Upload outside the lock so S3 network requests
    # do not block other dashboard requests.
    for reading in readings_to_save:
        try:
            store_sensor_data(reading)
        except Exception:
            app.logger.exception(
                "Failed to upload reading for %s",
                reading["id"]
            )

    return jsonify({
        "success": True,
        "message": "Sensor readings refreshed",
        "devices": current_devices
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

# Amazon S3 configuration
S3_BUCKET = "iot-sensor-telemetry-storage"

s3 = boto3.client("s3")

logging.basicConfig(level=logging.INFO)


def store_sensor_data(device):
    """Store one sensor reading in Amazon S3."""

    timestamp = datetime.now(timezone.utc)

    sensor_record = {
        "device_id": device["id"],
        "device_name": device["name"],
        "location": device["location"],
        "status": device["status"],
        "temperature": device["temperature"],
        "humidity": device["humidity"],
        "timestamp": timestamp.isoformat()
    }

    # Organize files by device and date
    s3_key = (
        f"sensor-data/{device['id']}/"
        f"{timestamp.strftime('%Y/%m/%d/')}"
        f"reading-{timestamp.strftime('%H%M%S%f')}.json"
    )

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=json.dumps(sensor_record),
        ContentType="application/json"
    )

    logging.info("Sensor data uploaded to S3: %s", s3_key)

    return s3_key


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

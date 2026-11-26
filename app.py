from flask import Flask, render_template, jsonify, request
from threading import Lock
import random, boto3, json, logging
from datetime import datetime, timezone, date, timedelta
from botocore.exceptions import BotoCoreError, ClientError

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
data_lock = Lock()
S3_BUCKET = "iot-sensor-telemetry-storage"  # Change if your bucket name differs
s3 = boto3.client("s3")

devices = [
    {"id":"IOT-001","name":"Temperature Sensor","location":"Production Unit A","status":"Online","temperature":28.5,"humidity":60,"last_updated":""},
    {"id":"IOT-002","name":"Pressure Sensor","location":"Production Unit B","status":"Online","temperature":30.0,"humidity":55,"last_updated":""},
    {"id":"IOT-003","name":"Vibration Sensor","location":"Motor Section","status":"Offline","temperature":32.0,"humidity":50,"last_updated":""},
    {"id":"IOT-004","name":"Humidity Sensor","location":"Storage Area","status":"Online","temperature":27.0,"humidity":65,"last_updated":""},
    {"id":"IOT-005","name":"Smart Gateway","location":"Control Room","status":"Online","temperature":29.0,"humidity":58,"last_updated":""}
]
for d in devices:
    d["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

def get_devices():
    return [d.copy() for d in devices]

def store_sensor_data(device):
    now = datetime.now(timezone.utc)
    record = {
        "device_id": device["id"], "device_name": device["name"],
        "location": device["location"], "status": device["status"],
        "temperature": device.get("temperature"), "humidity": device.get("humidity"),
        "timestamp": now.isoformat()
    }
    for field in ("pressure", "vibration"):
        if field in device:
            record[field] = device[field]
    key = f"sensor-data/{device['id']}/{now:%Y/%m/%d/}reading-{now:%H%M%S%f}.json"
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(record).encode(),
                  ContentType="application/json")
    app.logger.info("Uploaded S3 reading: %s", key)
    return key

@app.route("/")
def dashboard():
    return render_template("index.html")

@app.route("/health")
def health():
    return jsonify(status="healthy", message="IoT Dashboard API is running")

@app.route("/api/devices")
def get_all_devices():
    with data_lock:
        return jsonify(get_devices())

@app.route("/api/refresh", methods=["POST"])
def refresh_devices():
    save = []
    with data_lock:
        for d in devices:
            if d["status"] == "Offline":
                continue
            d["temperature"] = round(max(0, min(100, d["temperature"] + random.uniform(-1.5, 1.5))), 1)
            d["humidity"] = round(max(0, min(100, d["humidity"] + random.uniform(-3, 3))), 1)
            d["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            save.append(d.copy())
        current = get_devices()
    for reading in save:
        try:
            store_sensor_data(reading)
        except Exception:
            app.logger.exception("S3 upload failed for %s", reading["id"])
    return jsonify(success=True, message="Sensor readings refreshed", devices=current)

@app.route("/api/sensor", methods=["POST"])
def update_sensor():
    data = request.get_json(silent=True) or {}
    device_id = data.get("device_id")
    if not device_id:
        return jsonify(success=False, message="device_id is required"), 400
    values = {}
    for field in ("temperature", "humidity"):
        try:
            values[field] = float(data.get(field))
        except (TypeError, ValueError):
            return jsonify(success=False, message=f"{field} must be a number"), 400
        if not 0 <= values[field] <= 100:
            return jsonify(success=False, message=f"{field} must be between 0 and 100"), 400
    for field in ("pressure", "vibration"):
        if data.get(field) is not None:
            try:
                values[field] = float(data[field])
            except (TypeError, ValueError):
                return jsonify(success=False, message=f"{field} must be a number"), 400

    updated = None
    with data_lock:
        for d in devices:
            if d["id"] == device_id:
                d.update(values)
                d["status"] = "Online"
                d["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                updated = d.copy()
                break
    if updated is None:
        return jsonify(success=False, message="Device not found"), 404
    try:
        key = store_sensor_data(updated)
        return jsonify(success=True, message="Sensor data updated and stored in S3",
                       s3_key=key, device=updated)
    except (BotoCoreError, ClientError, Exception):
        app.logger.exception("S3 upload failed")
        return jsonify(success=False, message="Sensor updated in memory, but S3 storage failed"), 503

@app.route("/api/history")
def get_sensor_history():
    device_id = request.args.get("device_id", "").strip()
    if not device_id:
        return jsonify(success=False, message="device_id is required"), 400
    if not any(d["id"] == device_id for d in devices):
        return jsonify(success=False, message="Unknown device_id"), 404
    today = date.today()
    try:
        end_day = date.fromisoformat(request.args.get("end_date", today.isoformat()))
        start_day = date.fromisoformat(request.args.get("start_date", (today - timedelta(days=6)).isoformat()))
        limit = max(1, min(int(request.args.get("limit", "500")), 1000))
    except ValueError:
        return jsonify(success=False, message="Use YYYY-MM-DD dates and an integer limit"), 400
    if start_day > end_day:
        return jsonify(success=False, message="start_date must be on or before end_date"), 400
    if (end_day - start_day).days > 366:
        return jsonify(success=False, message="Date range cannot exceed 367 days"), 400

    readings = []
    try:
        day = start_day
        while day <= end_day and len(readings) < limit:
            prefix = f"sensor-data/{device_id}/{day:%Y/%m/%d}/"
            paginator = s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
                for item in page.get("Contents", []):
                    obj = s3.get_object(Bucket=S3_BUCKET, Key=item["Key"])
                    record = json.loads(obj["Body"].read().decode("utf-8"))
                    record.setdefault("timestamp", item["LastModified"].isoformat())
                    record.setdefault("s3_key", item["Key"])
                    readings.append(record)
                    if len(readings) >= limit:
                        break
                if len(readings) >= limit:
                    break
            day += timedelta(days=1)
        readings.sort(key=lambda x: x.get("timestamp", ""))
        return jsonify(success=True, device_id=device_id, start_date=start_day.isoformat(),
                       end_date=end_day.isoformat(), count=len(readings), readings=readings)
    except (BotoCoreError, ClientError, json.JSONDecodeError, UnicodeDecodeError):
        app.logger.exception("Could not read S3 history")
        return jsonify(success=False, message="Unable to retrieve history from S3"), 502

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)


import pytest
from app import app, devices


@pytest.fixture
def client():
    app.config["TESTING"] = True

    # Save original device data
    original_devices = [device.copy() for device in devices]

    with app.test_client() as test_client:
        yield test_client

    # Restore device data after each test
    devices.clear()
    devices.extend(original_devices)


def test_home_page(client):
    response = client.get("/")

    assert response.status_code == 200


def test_health_check(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json["status"] == "healthy"


def test_get_devices(client):
    response = client.get("/api/devices")

    assert response.status_code == 200
    assert len(response.json) == 5

    assert response.json[0]["id"] == "IOT-001"


def test_sensor_update(client):
    response = client.post(
        "/api/sensor",
        json={
            "device_id": "IOT-001",
            "temperature": 38.5,
            "humidity": 72
        }
    )

    assert response.status_code == 200
    assert response.json["success"] is True
    assert response.json["device"]["temperature"] == 38.5
    assert response.json["device"]["humidity"] == 72


def test_receive_sensor_data(client):
    response = client.post(
        "/api/sensor",
        json={
            "device_id": "IOT-002",
            "temperature": 35.0,
            "humidity": 68
        }
    )

    assert response.status_code == 200

    data = response.json

    assert data["success"] is True
    assert data["device"]["id"] == "IOT-002"
    assert data["device"]["temperature"] == 35.0
    assert data["device"]["humidity"] == 68.0


def test_invalid_sensor_data(client):
    response = client.post(
        "/api/sensor",
        json={
            "device_id": "IOT-001",
            "temperature": 35.0,
            "humidity": 150
        }
    )

    assert response.status_code == 400
    assert response.json["message"] == "Humidity must be between 0 and 100"


def test_unknown_device(client):
    response = client.post(
        "/api/sensor",
        json={
            "device_id": "IOT-999",
            "temperature": 30,
            "humidity": 60
        }
    )

    assert response.status_code == 404
    assert response.json["success"] is False


def test_refresh_devices(client):
    response = client.post("/api/refresh")

    assert response.status_code == 200
    assert response.json["success"] is True
    assert len(response.json["devices"]) == 5

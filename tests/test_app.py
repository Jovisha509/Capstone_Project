
from app import app

def test_home_page():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_health_check():
    client = app.test_client()
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json["status"] == "UP"


def test_device_api():
    client = app.test_client()
    response = client.get("/api/devices")

    assert response.status_code == 200
    assert len(response.json) >= 3


def test_sensor_update():
    client = app.test_client()

    response = client.post(
        "/api/update"
    )

    assert response.status_code == 200


def test_receive_sensor_data():
    client = app.test_client()

    response = client.post(
        "/api/sensor",
        json={
            "device_id": "IOT-004",
            "temperature": 45,
            "humidity": 60
        }
    )

    assert response.status_code == 201


def test_invalid_sensor_data():
    client = app.test_client()

    response = client.post(
        "/api/sensor",
        json={
            "device_id": "IOT-005",
            "temperature": 45,
            "humidity": 150
        }
    )

    assert response.status_code == 400

"""Integration tests for product image upload/delete/primary-selection
(Phase 4), exercising the real LocalImageStorage against a temp directory
(see tests/conftest.py's UPLOAD_DIR override).
"""

from pathlib import Path

from app.models import CatalogActivity
from app.services import storage as storage_module
from app.utils.config import get_settings
from tests.conftest import auth_headers, tiny_jpeg_bytes


def _owner_a_headers(client, owner_a):
    return auth_headers(client, owner_a.email, "OwnerA123!")


def _owner_b_headers(client, owner_b):
    return auth_headers(client, owner_b.email, "OwnerB123!")


def _create_product(client, shop_id, category_id, headers, **overrides):
    payload = {"name": "Banarasi Silk Saree", "category_id": category_id, "price": 8500.00}
    payload.update(overrides)
    resp = client.post(f"/api/shops/{shop_id}/products", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _upload(client, shop_id, product_id, headers, *, filename="photo.jpg", content=None, content_type="image/jpeg"):
    content = content if content is not None else tiny_jpeg_bytes()
    return client.post(
        f"/api/shops/{shop_id}/products/{product_id}/images",
        headers=headers,
        files={"file": (filename, content, content_type)},
    )


def _uploaded_file_path(image_url: str) -> Path:
    settings = get_settings()
    prefix = f"{settings.api_base_url}/uploads/"
    assert image_url.startswith(prefix)
    return Path(settings.upload_dir) / image_url[len(prefix) :]


# --- Upload ------------------------------------------------------------------


def test_upload_first_image_becomes_primary(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = _upload(client, shop_a.id, product["id"], headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["primary_image_url"] == body["image"]["image_url"]

    # File actually landed on disk.
    path = _uploaded_file_path(body["image"]["image_url"])
    assert path.exists()

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_IMAGE_UPLOADED")
        .all()
    )
    assert len(activity) == 1


def test_upload_second_image_does_not_change_primary(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    first = _upload(client, shop_a.id, product["id"], headers).json()
    second = _upload(client, shop_a.id, product["id"], headers).json()

    assert second["primary_image_url"] == first["image"]["image_url"]

    detail = client.get(f"/api/shops/{shop_a.id}/products/{product['id']}", headers=headers).json()
    assert len(detail["images"]) == 2
    assert detail["primary_image_url"] == first["image"]["image_url"]


def test_upload_rejects_unsupported_content_type(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = _upload(
        client, shop_a.id, product["id"], headers,
        filename="notes.txt", content=b"just some text", content_type="text/plain",
    )
    assert resp.status_code == 422


def test_upload_rejects_invalid_image_bytes(client, shop_a, category_a, owner_a):
    """Content-Type claims image/jpeg, but the bytes aren't a real image --
    Pillow's decode should catch this even though the header alone wouldn't."""
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = _upload(
        client, shop_a.id, product["id"], headers,
        filename="fake.jpg", content=b"not-a-real-image-just-bytes", content_type="image/jpeg",
    )
    assert resp.status_code == 422


def test_upload_rejects_oversized_image(client, shop_a, category_a, owner_a, monkeypatch):
    monkeypatch.setattr(storage_module, "MAX_IMAGE_BYTES", 10)  # tiny cap, easy to exceed
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = _upload(client, shop_a.id, product["id"], headers)
    assert resp.status_code == 422
    assert "too large" in resp.json()["detail"].lower()


def test_upload_rejects_empty_file(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = _upload(client, shop_a.id, product["id"], headers, content=b"")
    assert resp.status_code == 422


# --- Delete ------------------------------------------------------------------


def test_delete_non_primary_image_keeps_primary(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)
    first = _upload(client, shop_a.id, product["id"], headers).json()
    second = _upload(client, shop_a.id, product["id"], headers).json()

    resp = client.delete(
        f"/api/shops/{shop_a.id}/products/{product['id']}/images/{second['image']['id']}", headers=headers
    )
    assert resp.status_code == 204

    detail = client.get(f"/api/shops/{shop_a.id}/products/{product['id']}", headers=headers).json()
    assert detail["primary_image_url"] == first["image"]["image_url"]
    assert len(detail["images"]) == 1
    # File removed from disk too.
    assert not _uploaded_file_path(second["image"]["image_url"]).exists()


def test_delete_primary_image_reassigns_to_remaining(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)
    first = _upload(client, shop_a.id, product["id"], headers).json()
    second = _upload(client, shop_a.id, product["id"], headers).json()

    resp = client.delete(
        f"/api/shops/{shop_a.id}/products/{product['id']}/images/{first['image']['id']}", headers=headers
    )
    assert resp.status_code == 204

    detail = client.get(f"/api/shops/{shop_a.id}/products/{product['id']}", headers=headers).json()
    assert detail["primary_image_url"] == second["image"]["image_url"]


def test_delete_last_image_clears_primary(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)
    only = _upload(client, shop_a.id, product["id"], headers).json()

    resp = client.delete(
        f"/api/shops/{shop_a.id}/products/{product['id']}/images/{only['image']['id']}", headers=headers
    )
    assert resp.status_code == 204

    detail = client.get(f"/api/shops/{shop_a.id}/products/{product['id']}", headers=headers).json()
    assert detail["primary_image_url"] is None
    assert detail["images"] == []


def test_delete_image_logs_activity(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)
    image = _upload(client, shop_a.id, product["id"], headers).json()

    client.delete(f"/api/shops/{shop_a.id}/products/{product['id']}/images/{image['image']['id']}", headers=headers)

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_IMAGE_DELETED")
        .all()
    )
    assert len(activity) == 1


def test_delete_nonexistent_image_404(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = client.delete(f"/api/shops/{shop_a.id}/products/{product['id']}/images/999999", headers=headers)
    assert resp.status_code == 404


# --- Primary selection -------------------------------------------------------


def test_set_primary_image(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)
    first = _upload(client, shop_a.id, product["id"], headers).json()
    second = _upload(client, shop_a.id, product["id"], headers).json()
    assert first["primary_image_url"] != second["image"]["image_url"]

    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{product['id']}/images/{second['image']['id']}/primary",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["primary_image_url"] == second["image"]["image_url"]


def test_set_primary_image_not_found(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers)

    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{product['id']}/images/999999/primary", headers=headers
    )
    assert resp.status_code == 404


# --- Shop isolation -----------------------------------------------------------


def test_shop_owner_cannot_upload_image_to_another_shops_product(
    client, shop_a, shop_b, category_a, owner_a, owner_b
):
    headers_a = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers_a)

    resp = _upload(client, shop_a.id, product["id"], _owner_b_headers(client, owner_b))
    assert resp.status_code == 404


def test_shop_owner_cannot_delete_image_on_another_shops_product(
    client, shop_a, shop_b, category_a, owner_a, owner_b
):
    headers_a = _owner_a_headers(client, owner_a)
    product = _create_product(client, shop_a.id, category_a.id, headers_a)
    image = _upload(client, shop_a.id, product["id"], headers_a).json()

    resp = client.delete(
        f"/api/shops/{shop_a.id}/products/{product['id']}/images/{image['image']['id']}",
        headers=_owner_b_headers(client, owner_b),
    )
    assert resp.status_code == 404

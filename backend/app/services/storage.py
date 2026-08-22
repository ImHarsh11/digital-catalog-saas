"""Image storage abstraction (Phase 4).

Two implementations behind one interface, selected by
`settings.image_storage_provider`:

- `LocalImageStorage` -- writes to disk under `settings.upload_dir`, served
  back out by the `/uploads` static mount in `app.main`. Used for local
  development so nobody needs Cloudinary credentials to work on the
  product/image features.
- `CloudinaryImageStorage` -- uploads to Cloudinary. Not exercised in local
  dev or tests, but implemented against the same interface so switching
  `IMAGE_STORAGE_PROVIDER=cloudinary` in production is a config change, not
  a code change.

Callers only ever depend on the `ImageStorage` interface and
`get_image_storage()` -- never on a concrete provider class.
"""

from __future__ import annotations

import io
import re
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.utils.config import get_settings

# JPEG/PNG/WebP cover everything a phone camera or a quick product photo
# export will produce, without opening the door to arbitrary file types.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB -- generous for a phone photo, not for abuse.


class ImageValidationError(Exception):
    """A user-facing validation failure -- the API layer turns this into a 422."""


def validate_image_upload(content: bytes, content_type: str | None) -> None:
    """Raise ImageValidationError if `content` isn't an acceptable image.

    Checks content-type, size, and (via Pillow) that the bytes actually
    decode as an image of that type -- a spoofed Content-Type header alone
    isn't enough to get bad data stored and served back to customers.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ImageValidationError(
            "Unsupported image type. Please upload a JPEG, PNG, or WebP photo."
        )
    if not content:
        raise ImageValidationError("The uploaded file is empty.")
    if len(content) > MAX_IMAGE_BYTES:
        max_mb = MAX_IMAGE_BYTES // (1024 * 1024)
        raise ImageValidationError(f"Image is too large. Please upload a photo under {max_mb}MB.")

    try:
        from PIL import Image, UnidentifiedImageError

        with Image.open(io.BytesIO(content)) as img:
            img.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError(
            "This file doesn't look like a valid image. Please try a different photo."
        ) from exc


class ImageStorage(ABC):
    """Where uploaded product photos live. `folder` is a caller-chosen
    grouping path, e.g. `products/{shop_id}/{product_id}` -- storage
    implementations don't know anything about shops or products."""

    @abstractmethod
    def save(self, content: bytes, content_type: str, *, folder: str) -> str:
        """Persist the image and return its publicly-accessible URL."""

    @abstractmethod
    def delete(self, url: str) -> None:
        """Best-effort delete. Never raises -- a missing/foreign file is a no-op."""


class LocalImageStorage(ImageStorage):
    """Writes files to disk under `base_dir`, served from `base_url` + `/uploads`."""

    def __init__(self, base_dir: Path, base_url: str):
        self.base_dir = base_dir
        self.base_url = base_url.rstrip("/")

    def save(self, content: bytes, content_type: str, *, folder: str) -> str:
        ext = ALLOWED_CONTENT_TYPES[content_type]
        filename = f"{uuid.uuid4().hex}.{ext}"
        target_dir = self.base_dir / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / filename).write_bytes(content)
        return f"{self.base_url}/uploads/{folder}/{filename}"

    def delete(self, url: str) -> None:
        prefix = f"{self.base_url}/uploads/"
        if not url.startswith(prefix):
            return
        relative = url[len(prefix) :]
        path = (self.base_dir / relative).resolve()
        try:
            # Refuse to delete anything that escaped base_dir via "..".
            path.relative_to(self.base_dir.resolve())
        except ValueError:
            return
        path.unlink(missing_ok=True)


class CloudinaryImageStorage(ImageStorage):
    """Cloudinary-backed storage. Configured but not used in local dev --
    switching `IMAGE_STORAGE_PROVIDER=cloudinary` (with real credentials)
    is all that's needed to activate this in a deployed environment."""

    _PUBLIC_ID_PATTERN = re.compile(r"/upload/(?:v\d+/)?(?P<public_id>.+)\.[a-zA-Z0-9]+$")

    def __init__(self, cloud_name: str, api_key: str, api_secret: str):
        import cloudinary

        cloudinary.config(
            cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True
        )

    def save(self, content: bytes, content_type: str, *, folder: str) -> str:
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            io.BytesIO(content), folder=folder, resource_type="image"
        )
        return result["secure_url"]

    def delete(self, url: str) -> None:
        import cloudinary.uploader

        match = self._PUBLIC_ID_PATTERN.search(url)
        if not match:
            return
        try:
            cloudinary.uploader.destroy(match.group("public_id"), resource_type="image")
        except Exception:
            # Best-effort: an orphaned remote file is far less bad than a
            # 500 on a product-delete request.
            pass


def get_image_storage() -> ImageStorage:
    settings = get_settings()
    if settings.image_storage_provider == "cloudinary":
        if not (
            settings.cloudinary_cloud_name
            and settings.cloudinary_api_key
            and settings.cloudinary_api_secret
        ):
            raise RuntimeError(
                "IMAGE_STORAGE_PROVIDER=cloudinary but Cloudinary credentials are not "
                "configured. Set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET, or switch back "
                "to IMAGE_STORAGE_PROVIDER=local for development."
            )
        return CloudinaryImageStorage(
            settings.cloudinary_cloud_name,
            settings.cloudinary_api_key,
            settings.cloudinary_api_secret,
        )
    return LocalImageStorage(base_dir=Path(settings.upload_dir), base_url=settings.api_base_url)

"""Validate and normalise uploaded images before they reach the model."""
import io
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import get_settings

# Refuse decompression bombs early: a tiny file can declare a gigantic canvas.
MAX_PIXELS = 40_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
MAX_EDGE = 1568  # larger images are downscaled by the API anyway; saves tokens
MIN_EDGE = 64


@dataclass
class ProcessedImage:
    name: str
    data: bytes  # JPEG bytes
    width: int
    height: int
    media_type: str = "image/jpeg"


def _process_one(upload: UploadFile) -> ProcessedImage:
    settings = get_settings()
    limit = settings.max_image_mb * 1024 * 1024
    name = upload.filename or "image"
    raw = upload.file.read(limit + 1)
    if not raw:
        raise HTTPException(422, f"'{name}' is empty.")
    if len(raw) > limit:
        raise HTTPException(413, f"'{name}' exceeds the {settings.max_image_mb} MB limit.")
    try:
        img = Image.open(io.BytesIO(raw))
        if img.format not in ALLOWED_FORMATS:
            raise HTTPException(415, f"'{name}' is {img.format}; use JPEG, PNG, WEBP or GIF.")
        if img.width * img.height > MAX_PIXELS:
            raise HTTPException(413, f"'{name}' is {img.width}x{img.height}; images over 40 megapixels aren't accepted.")
        img.draft("RGB", (MAX_EDGE * 2, MAX_EDGE * 2))  # cheap JPEG downscale while decoding
        img.load()  # raises OSError on truncated / incomplete files
        img = ImageOps.exif_transpose(img).convert("RGB")
    except HTTPException:
        raise
    except Image.DecompressionBombError:
        raise HTTPException(413, f"'{name}' is too large in pixels to process.")
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, TypeError):
        raise HTTPException(
            422, f"'{name}' is not a readable image (corrupted or incomplete upload)."
        )
    if min(img.size) < MIN_EDGE:
        raise HTTPException(422, f"'{name}' is too small ({img.width}x{img.height}) to analyse.")
    img.thumbnail((MAX_EDGE, MAX_EDGE))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return ProcessedImage(name=name, data=buf.getvalue(), width=img.width, height=img.height)


def process_uploads(uploads: list[UploadFile] | None, *, required: bool = False) -> list[ProcessedImage]:
    settings = get_settings()
    # Browsers send an empty part when no file is chosen.
    files = [u for u in (uploads or []) if u and u.filename]
    if required and not files:
        raise HTTPException(422, "At least one image is required.")
    if len(files) > settings.max_images:
        raise HTTPException(422, f"At most {settings.max_images} images per request.")
    return [_process_one(u) for u in files]

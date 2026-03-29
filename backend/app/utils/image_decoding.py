import io
import logging
from typing import Literal, Optional

import numpy as np

try:
    import cv2  # type: ignore
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore

try:
    from PIL import Image as PILImage
except ImportError:  # pragma: no cover
    PILImage = None  # type: ignore

logger = logging.getLogger(__name__)


def decode_image_bytes(
    image_content: bytes, mode: Literal["color", "grayscale"] = "color"
) -> np.ndarray:
    """
    Decode raw image bytes into a numpy array.

    When OpenCV's imdecode is unavailable (common on slim builds), fall back to
    Pillow so uploads still work.
    """
    last_error: Optional[str] = None

    if cv2 is not None and hasattr(cv2, "imdecode"):
        try:
            nparr = np.frombuffer(image_content, np.uint8)
            flag = cv2.IMREAD_GRAYSCALE if mode == "grayscale" else cv2.IMREAD_COLOR
            image = cv2.imdecode(nparr, flag)
            if image is not None:
                return image
            last_error = "cv2.imdecode returned None"
        except Exception as exc:  # pragma: no cover
            last_error = f"cv2.imdecode failed: {exc}"
            logger.warning(last_error)
    else:
        logger.debug("cv2.imdecode unavailable, using Pillow for decoding")

    if PILImage is not None:
        try:
            with PILImage.open(io.BytesIO(image_content)) as pil_image:
                if mode == "grayscale":
                    pil_image = pil_image.convert("L")
                    return np.array(pil_image)
                pil_image = pil_image.convert("RGB")
                np_image = np.array(pil_image)
                # Keep channel order consistent with OpenCV (BGR)
                return np_image[:, :, ::-1]
        except Exception as exc:
            last_error = f"Pillow failed to decode image: {exc}"
            logger.warning(last_error)

    raise ValueError(last_error or "No available decoder for image bytes")


def _cv2_supports(attr: str) -> bool:
    return cv2 is not None and hasattr(cv2, attr)


def _match_dtype(data: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if np.issubdtype(dtype, np.integer):
        info = np.iinfo(dtype)
        data = np.clip(np.rint(data), info.min, info.max)
        return data.astype(dtype)
    return data.astype(dtype)


def bgr_to_gray(image: np.ndarray) -> np.ndarray:
    """Convert BGR image to grayscale even if cv2 lacks cvtColor."""
    if _cv2_supports("cvtColor") and _cv2_supports("COLOR_BGR2GRAY"):
        code = getattr(cv2, "COLOR_BGR2GRAY")
        return cv2.cvtColor(image, code)

    if image.ndim != 3 or image.shape[2] < 3:
        raise ValueError("Expected a BGR image with 3 channels")

    image_float = image.astype(np.float32)
    gray = (
        image_float[..., 0] * 0.114
        + image_float[..., 1] * 0.587
        + image_float[..., 2] * 0.299
    )
    return _match_dtype(gray, image.dtype)


def gray_to_bgr(image: np.ndarray) -> np.ndarray:
    """Convert single-channel grayscale image to 3-channel BGR."""
    if _cv2_supports("cvtColor") and _cv2_supports("COLOR_GRAY2BGR"):
        code = getattr(cv2, "COLOR_GRAY2BGR")
        return cv2.cvtColor(image, code)

    if image.ndim != 2:
        raise ValueError("Expected a 2D grayscale image")

    return np.stack([image, image, image], axis=-1)


def gray_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert grayscale image to RGB channels."""
    if _cv2_supports("cvtColor") and _cv2_supports("COLOR_GRAY2RGB"):
        code = getattr(cv2, "COLOR_GRAY2RGB")
        return cv2.cvtColor(image, code)

    if image.ndim != 2:
        raise ValueError("Expected a 2D grayscale image")

    return np.stack([image, image, image], axis=-1)


def bgr_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert BGR image to RGB without relying on cv2.cvtColor."""
    if _cv2_supports("cvtColor") and _cv2_supports("COLOR_BGR2RGB"):
        code = getattr(cv2, "COLOR_BGR2RGB")
        return cv2.cvtColor(image, code)

    if image.ndim != 3 or image.shape[2] < 3:
        raise ValueError("Expected a BGR image with 3 channels")

    return image[:, :, ::-1]


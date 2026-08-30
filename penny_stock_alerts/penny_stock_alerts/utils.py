"""Small shared helpers: logging setup and a retry decorator."""
from __future__ import annotations

import functools
import logging
import time
from typing import Callable, TypeVar

T = TypeVar("T")


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def retry(times: int = 3, initial_delay: float = 2.0, backoff: float = 2.0):
    """Retry a flaky call (e.g. a network request) with exponential backoff."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            logger = logging.getLogger(func.__module__)
            delay = initial_delay
            last_exc: Exception | None = None
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:  # noqa: BLE001 - deliberately broad, we retry any failure
                    last_exc = exc
                    logger.warning(
                        "%s failed on attempt %d/%d: %s", func.__name__, attempt, times, exc
                    )
                    if attempt < times:
                        time.sleep(delay)
                        delay *= backoff
            assert last_exc is not None
            raise last_exc

        return wrapper

    return decorator

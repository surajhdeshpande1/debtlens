from __future__ import annotations


class ApiError(Exception):
    """Raised anywhere in a request; rendered as {"error": message} with the status code."""

    def __init__(self, status: int, message: str, **extra):
        super().__init__(message)
        self.status = status
        self.message = message
        self.extra = extra

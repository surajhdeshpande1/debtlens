from datetime import datetime, timezone

def utc_now() -> datetime:
    """Return timezone-naive UTC timestamp for standard SQL/database compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


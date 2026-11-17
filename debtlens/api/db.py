"""Database connection.

DATABASE_URL examples
    mysql+pymysql://root:secret@localhost:3306/debtlens          local MySQL 8
    mysql://USER:PASS@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/debtlens   TiDB Cloud
    sqlite:///debtlens.db                                          quick local try-out / tests
TiDB Cloud's Vercel integration may instead set TIDB_HOST / TIDB_PORT / TIDB_USER /
TIDB_PASSWORD / TIDB_DATABASE — both forms are accepted.  TLS is switched on
automatically for TiDB Cloud (required) or with DB_SSL=1.
"""

from __future__ import annotations

import os
import threading
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .models import Base

_engine: Engine | None = None
_Session: sessionmaker | None = None
_lock = threading.Lock()
_initialised = False


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("TIDB_DATABASE_URL")
    if not url and os.environ.get("TIDB_HOST"):
        user = quote_plus(os.environ.get("TIDB_USER", "root"))
        pwd = quote_plus(os.environ.get("TIDB_PASSWORD", ""))
        host = os.environ["TIDB_HOST"]
        port = os.environ.get("TIDB_PORT", "4000")
        name = os.environ.get("TIDB_DATABASE") or os.environ.get("TIDB_DB_NAME") or "debtlens"
        url = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}"
    if not url:
        url = "sqlite:///debtlens-local.db"
    if url.startswith("mysql://"):
        url = "mysql+pymysql://" + url[len("mysql://"):]
    # drop Prisma/driver-specific query options PyMySQL does not understand
    parts = urlsplit(url)
    if parts.scheme.startswith("mysql"):
        q = [(k, v) for k, v in parse_qsl(parts.query) if k in ("charset",)]
        if not any(k == "charset" for k, _ in q):
            q.append(("charset", "utf8mb4"))
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), ""))
    return url


def _ssl_args(url: str) -> dict:
    host = urlsplit(url).hostname or ""
    if "tidbcloud.com" in host or os.environ.get("DB_SSL") == "1":
        try:
            import certifi

            ca = certifi.where()
        except ImportError:
            ca = "/etc/ssl/certs/ca-certificates.crt"
        return {"ssl": {"ca": ca}, "ssl_verify_cert": True, "ssl_verify_identity": True}
    return {}


def make_engine(url: str | None = None) -> Engine:
    url = url or database_url()
    if url.startswith("sqlite"):
        if url in ("sqlite://", "sqlite:///:memory:"):
            return create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, connect_args=_ssl_args(url), pool_size=3, max_overflow=4, pool_recycle=280,
                         pool_pre_ping=True, pool_timeout=20)


def configure(url: str | None = None) -> Engine:
    global _engine, _Session, _initialised
    with _lock:
        if _engine is not None:
            _engine.dispose()
        _engine = make_engine(url)
        _Session = sessionmaker(bind=_engine, expire_on_commit=False)
        _initialised = False
    return _engine


def engine() -> Engine:
    if _engine is None:
        configure()
    return _engine  # type: ignore[return-value]


def session() -> Session:
    if _Session is None:
        configure()
    return _Session()  # type: ignore[misc]


def init_db() -> None:
    """Create missing tables once per process (cheap check on warm instances)."""
    global _initialised
    if _initialised:
        return
    with _lock:
        if _initialised:
            return
        eng = engine()
        existing = set(inspect(eng).get_table_names())
        missing = [t for t in Base.metadata.sorted_tables if t.name not in existing]
        if missing:
            Base.metadata.create_all(eng, tables=missing)
        _initialised = True


def ping() -> dict:
    eng = engine()
    with eng.connect() as c:
        version = c.execute(text("SELECT VERSION()" if eng.dialect.name != "sqlite" else "SELECT sqlite_version()")).scalar()
    backend = eng.dialect.name
    if "TiDB" in str(version):
        backend = "tidb"
    return {"dialect": eng.dialect.name, "backend": backend, "version": str(version)}

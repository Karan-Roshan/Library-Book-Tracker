# Shared database connection helpers for the Python tools.

from __future__ import annotations

import os
from pathlib import Path

from pymongo import MongoClient

def _load_dotenv(path: Path) -> None:

    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

_load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DEFAULT_URI = "mongodb://127.0.0.1:27017"
DEFAULT_DB = "library_management_system"

def connect(uri: str | None = None, name: str | None = None):

    uri = uri or os.environ.get("MONGODB_URI", DEFAULT_URI)
    name = name or os.environ.get("MONGODB_DB", DEFAULT_DB)

    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")
    return client[name]

def describe(uri: str) -> str:

    if "@" not in uri:
        return uri
    scheme, rest = uri.split("://", 1)
    _, host = rest.split("@", 1)
    return f"{scheme}://***:***@{host}"

COLLECTIONS = [

    "books",
    "bookCopies",
    "locations",
    "members",
    "borrowings",
    "holds",

    "addedBooks",
    "addedMembers",
    "issuedBorrowings",
    "reservations",
    "manualFines",
    "repairs",
    "lostReports",
    "messages",

    "users",
    "memberLogins",
    "invitations",
    "outbox",

    "activity",
    "settingsHistory",
    "backups",
    "values",
]

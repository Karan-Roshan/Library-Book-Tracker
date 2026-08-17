# Prints a summary of what the database holds.

from __future__ import annotations

import argparse
import sys

from pymongo import MongoClient

from db import COLLECTIONS, DEFAULT_DB, DEFAULT_URI, connect, describe

GROUPS = [
    ("Catalogue", ["books", "bookCopies", "locations", "members", "borrowings", "holds"]),
    (
        "Desk activity",
        ["addedBooks", "addedMembers", "issuedBorrowings", "reservations", "manualFines",
         "repairs", "lostReports", "messages"],
    ),
    ("Accounts", ["users", "memberLogins", "invitations", "outbox"]),
    ("Audit & config", ["activity", "settingsHistory", "backups", "values"]),
]

def main() -> int:
    parser = argparse.ArgumentParser(description="Show what a database holds.")
    parser.add_argument("--uri", default=None, help="Connection string")
    parser.add_argument("--db", default=None, help="Database name")
    parser.add_argument("--empty", action="store_true", help="Include empty collections")
    args = parser.parse_args()

    uri = args.uri or DEFAULT_URI
    try:
        database = connect(args.uri, args.db)
    except Exception as error:
        print(f"Cannot reach {describe(uri)}: {error}")
        return 1

    print(f"{describe(uri)}/{database.name}\n")

    total = 0
    for heading, names in GROUPS:
        rows = [(name, database[name].count_documents({})) for name in names]
        shown = rows if args.empty else [row for row in rows if row[1]]
        if not shown:
            continue

        print(heading)
        for name, count in shown:
            print(f"  {name:<20}{count:>8,}")
            total += count
        print()

    print(f"  {'TOTAL':<20}{total:>8,}")

    if database["books"].count_documents({}) == 0:
        print("\n⚠ No catalogue stored here.")
        print("  The app would fall back to its generated seed — which is read-only")
        print("  and not shared. Run tools/migrate.py or `npm run seed:library`.")

    unknown = set(database.list_collection_names()) - set(COLLECTIONS)
    if unknown:
        print(f"\nAlso present (not Athenaeum's): {', '.join(sorted(unknown))}")

    return 0

if __name__ == "__main__":
    sys.exit(main())

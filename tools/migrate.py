# Copies the whole library from one MongoDB to another.

from __future__ import annotations

import argparse
import sys

from pymongo import MongoClient

from db import COLLECTIONS, DEFAULT_DB, DEFAULT_URI, connect, describe

BATCH = 500

def copy(source, target, name: str, replace: bool) -> tuple[int, int]:
    rows = list(source[name].find({}, {"_id": False}))
    if replace:
        target[name].delete_many({})

    written = 0
    for start in range(0, len(rows), BATCH):
        chunk = rows[start : start + BATCH]
        if chunk:
            target[name].insert_many(chunk, ordered=False)
            written += len(chunk)

    return len(rows), target[name].count_documents({})

def main() -> int:
    parser = argparse.ArgumentParser(description="Copy Athenaeum to another MongoDB.")
    parser.add_argument("--from", dest="source", default=DEFAULT_URI, help="Source URI")
    parser.add_argument("--to", dest="target", required=True, help="Destination URI")

    parser.add_argument("--db", default=DEFAULT_DB, help="Database name on both ends")
    parser.add_argument("--source-db", help="Override the source database name")
    parser.add_argument("--target-db", help="Override the destination database name")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Empty the destination collections first. Discards what is there.",
    )
    args = parser.parse_args()

    source_db = args.source_db or args.db
    target_db = args.target_db or args.db

    print(f"  from  {describe(args.source)}/{source_db}")
    print(f"  to    {describe(args.target)}/{target_db}\n")

    try:
        source = connect(args.source, source_db)
    except Exception as error:
        print(f"Cannot reach the source database: {error}")
        return 1

    try:
        client = MongoClient(args.target, serverSelectionTimeoutMS=15000)
        client.admin.command("ping")
        target = client[target_db]
    except Exception as error:
        print(f"Cannot reach the destination: {error}")
        print("\nIf this is Atlas, check that:")
        print("  • your current IP is on the Network Access allowlist")
        print("  • the password is URL-encoded (@ : / ? # [ ] all need escaping)")
        print("  • the user has readWrite on this database")
        return 1

    existing = target["books"].count_documents({})
    if existing and not args.replace:
        print(f"The destination already holds {existing} books. Nothing written.")
        print("Pass --replace to overwrite it — this discards what is there.")
        return 1

    print(f"{'COLLECTION':<18}{'READ':>8}{'WRITTEN':>10}")
    print("─" * 36)

    total_read = total_written = 0
    problems: list[str] = []

    for name in COLLECTIONS:
        try:
            read, written = copy(source, target, name, args.replace)
        except Exception as error:
            problems.append(f"{name}: {error}")
            print(f"{name:<18}{'—':>8}{'failed':>10}")
            continue

        total_read += read
        total_written += written
        if read:
            print(f"{name:<18}{read:>8}{written:>10}")
        if written < read:
            problems.append(f"{name}: read {read}, wrote {written}")

    print("─" * 36)
    print(f"{'TOTAL':<18}{total_read:>8}{total_written:>10}\n")

    for collection, keys in [
        ("bookCopies", ["bookId", "copyId"]),
        ("borrowings", ["memberId", "bookId", "copyId", "returnedAt"]),
        ("holds", ["bookId"]),
        ("members", ["membershipNumber"]),
        ("activity", ["at"]),
    ]:
        for key in keys:
            try:
                target[collection].create_index(key)
            except Exception:
                pass
    print("Indexes created.")

    if problems:
        print("\nProblems:")
        for problem in problems:
            print(f"  • {problem}")
        return 1

    if total_written == 0:
        print("\nNothing was copied — the source database is empty.")
        print(f"Check that {describe(args.source)}/{source_db} is the right database:")
        print("  mongosh --quiet --eval 'db.adminCommand({listDatabases:1}).databases"
              ".forEach(d => print(d.name))'")
        return 1

    print(f"\n{total_written} records are now in the destination.")
    print("Point MONGODB_URI at it and the live site will show this data.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

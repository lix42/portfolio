import sys
from supabase_client import get_supabase_client

# Parse arguments
use_remote = "--remote" in sys.argv
skip_confirm = "--yes" in sys.argv

supabase = get_supabase_client(use_remote=use_remote)

MOCK_UUID = "00000000-0000-0000-0000-000000000000"


def confirm():
    if skip_confirm:
        return True
    resp = input(
        "Are you sure you want to DELETE ALL rows from 'documents' and 'chunks'? This cannot be undone. (y/N): "
    )
    return resp.strip().lower() == "y"


def delete_all_rows(table_name):
    try:
        supabase.table(table_name).delete().gt("id", MOCK_UUID).execute()
        print(f"[DELETE] All rows deleted from '{table_name}'.")
    except Exception as e:
        print(f"[ERROR] Failed to delete from '{table_name}': {e}")
        sys.exit(1)


def is_table_empty(table_name):
    try:
        resp = supabase.table(table_name).select("id").limit(1).execute()
        if hasattr(resp, "data") and resp.data == []:
            return True
        return False
    except Exception as e:
        print(f"[ERROR] Failed to check '{table_name}': {e}")
        return False


def main():
    print("This script will DELETE ALL rows from the 'chunks' and 'documents' tables.")
    if not confirm():
        print("Aborted by user.")
        sys.exit(0)

    # Delete chunks first (to avoid FK issues), then documents
    delete_all_rows("chunks")
    delete_all_rows("documents")

    # Check if tables are empty
    chunks_empty = is_table_empty("chunks")
    documents_empty = is_table_empty("documents")
    print(f"[CHECK] 'chunks' table empty: {chunks_empty}")
    print(f"[CHECK] 'documents' table empty: {documents_empty}")
    if chunks_empty and documents_empty:
        print("[SUCCESS] Both tables are empty.")
    else:
        print("[WARNING] One or both tables are not empty.")


if __name__ == "__main__":
    main()

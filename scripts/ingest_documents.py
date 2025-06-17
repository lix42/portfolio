# Usage:
#   python ingest_documents.py [--remote]
#
# By default, connects to local Supabase instance using LOCAL_SUPABASE_URL and LOCAL_SUPABASE_KEY from .env.
# If --remote is passed, connects to remote Supabase using SUPABASE_URL and SUPABASE_KEY from .env.
#
# This script ingests all JSON files in documents/experiments/ as described in the project requirements.

import sys
import json
import os
import glob
import hashlib
from embedding import embed_texts
from supabase_client import get_supabase_client
from chunk import chunk_markdown

# Determine Supabase target
use_remote = "--remote" in sys.argv
supabase = get_supabase_client(use_remote=use_remote)

EXPERIMENTS_DIR = os.path.join(os.path.dirname(__file__), "../documents/experiments")


def compute_content_hash(content: str, tags: list) -> str:
    """Generate SHA256 hash from content and tags."""
    m = hashlib.sha256()
    m.update(content.encode("utf-8"))
    m.update(json.dumps(sorted(tags)).encode("utf-8"))
    return m.hexdigest()


def get_company_id(company_name: str):
    """Look up company by name and return its id, or None if not found."""
    resp = supabase.table("companies").select("id").eq("name", company_name).execute()
    if hasattr(resp, "data") and resp.data:
        return resp.data[0]["id"]
    return None


def get_existing_document(project: str):
    """Look up document by project name."""
    resp = (
        supabase.table("documents")
        .select("id, content_hash")
        .eq("project", project)
        .execute()
    )
    if hasattr(resp, "data") and resp.data:
        return resp.data[0]
    return None


def delete_chunks_by_document_id(document_id: str) -> None:
    """Delete all chunks associated with a document ID from the database."""
    try:
        supabase.table("chunks").delete().eq("document_id", document_id).execute()
    except Exception as e:
        print(f"[ERROR] Failed to delete chunks for document {document_id}: {e}")
        raise


def upsert_document(data: dict):
    """Upsert document into the documents table."""
    resp = supabase.table("documents").upsert(data, on_conflict="project").execute()
    return resp


def ingest_documents():
    json_files = glob.glob(os.path.join(EXPERIMENTS_DIR, "*.json"))
    for json_file in json_files:
        try:
            with open(json_file, "r") as f:
                doc_meta = json.load(f)
        except Exception as e:
            print(f"[ERROR] Failed to parse {json_file}: {e}")
            continue

        # Required fields
        project = doc_meta.get("project")
        document_path = doc_meta.get("document")
        company_name = doc_meta.get("company")
        tags = doc_meta.get("tags", [])

        if not (project and document_path and company_name):
            print(f"[ERROR] Missing required fields in {json_file}, skipping.")
            continue

        # Resolve document file path
        doc_file_path = os.path.join(EXPERIMENTS_DIR, document_path.lstrip("./"))
        if not os.path.isfile(doc_file_path):
            print(f"[ERROR] Document file {doc_file_path} not found, skipping.")
            continue

        try:
            with open(doc_file_path, "r") as f:
                content = f.read()
        except Exception as e:
            print(f"[ERROR] Failed to read {doc_file_path}: {e}")
            continue

        content_hash = compute_content_hash(content, tags)
        company_id = get_company_id(company_name)
        if not company_id:
            print(
                f"[ERROR] Company '{company_name}' not found in DB, skipping {project}."
            )
            continue

        existing_doc = get_existing_document(project)
        if existing_doc and existing_doc["content_hash"] == content_hash:
            print(f"[SKIP] {project}: No changes detected (hash match).")
            continue

        if existing_doc and existing_doc["content_hash"] != content_hash:
            # Delete existing chunks for this document before re-ingesting
            delete_chunks_by_document_id(existing_doc["id"])
            print(f"[DELETE] {project}: Removed existing chunks for re-ingestion.")

        data = {
            "content": content,
            "content_hash": content_hash,
            "company_id": company_id,
            "tags": tags,
            "project": project,
        }
        resp = upsert_document(data)
        if hasattr(resp, "status_code") and resp.status_code >= 400:
            print(f"[ERROR] Upserting {project}: {resp}")
            continue
        else:
            print(f"[UPSERT] {project}: Document upserted.")

        # Fetch document ID (from upsert response or by querying)
        doc_id = None
        if hasattr(resp, "data") and resp.data and "id" in resp.data[0]:
            doc_id = resp.data[0]["id"]
        else:
            # Fallback: query for document by project name
            doc_row = get_existing_document(project)
            if doc_row and "id" in doc_row:
                doc_id = doc_row["id"]
        if not doc_id:
            print(
                f"[ERROR] Could not determine document ID for {project}, skipping chunk insert."
            )
            continue

        # Prepare chunk records for batch insert
        chunks = chunk_markdown(content)
        embeddings = embed_texts(chunks)
        chunk_records = []
        for chunk, embedding in zip(chunks, embeddings):
            chunk_records.append(
                {
                    "content": chunk,
                    "embedding": embedding,
                    "document_id": doc_id,
                    "type": "markdown",
                }
            )
        if chunk_records:
            try:
                chunk_resp = supabase.table("chunks").insert(chunk_records).execute()
                if hasattr(chunk_resp, "status_code") and chunk_resp.status_code >= 400:
                    print(f"[ERROR] Inserting chunks for {project}: {chunk_resp}")
                else:
                    print(f"[CHUNKS] {project}: Inserted {len(chunk_records)} chunks.")
            except Exception as e:
                print(f"[ERROR] Exception during chunk insert for {project}: {e}")
        else:
            print(f"[CHUNKS] {project}: No chunks to insert.")

    print("Ingestion complete.")


def test_ingest_new_document():
    """Test: Insert a new document and verify it appears in the DB."""
    # This is a stub. In a real test, you would use a test DB or mock supabase.
    print("[TEST] test_ingest_new_document: Manual verification required.")


def test_skip_on_hash_match():
    """Test: Ingest same document twice, second time should skip."""
    print("[TEST] test_skip_on_hash_match: Manual verification required.")


def test_update_on_hash_change():
    """Test: Change content, re-ingest, should update document."""
    print("[TEST] test_update_on_hash_change: Manual verification required.")


if __name__ == "__main__":
    if "--test" in sys.argv:
        test_ingest_new_document()
        test_skip_on_hash_match()
        test_update_on_hash_change()
    else:
        ingest_documents()

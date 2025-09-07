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
from supabase_data_access import SupabaseDataAccessProvider
from data_access import DataAccessProvider, Document, Chunk
from chunk import chunk_markdown
from generate_tags import generate_tags

__all__ = ["ingest_documents"]

EXPERIMENTS_DIR = os.path.join(os.path.dirname(__file__), "../documents/experiments")


def _compute_content_hash(content: str, tags: list) -> str:
    """Generate SHA256 hash from content and tags."""
    m = hashlib.sha256()
    m.update(content.encode("utf-8"))
    m.update(json.dumps(sorted(tags)).encode("utf-8"))
    return m.hexdigest()


def ingest_documents(
    use_remote: bool = False, data_provider: DataAccessProvider = None
) -> None:
    """
    Ingest documents from experiments directory into database.

    Args:
        use_remote: If True, use remote Supabase instance. Otherwise use local.
        data_provider: Optional data access provider. If None, creates Supabase provider.
    """
    if data_provider is None:
        supabase = get_supabase_client(use_remote=use_remote)
        data_provider = SupabaseDataAccessProvider(supabase)

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

        # Generate tags from document content using OpenAI
        tags = generate_tags(content)

        content_hash = _compute_content_hash(content, tags)

        # Get company ID using data access layer
        company_id = data_provider.companies.get_company_id_by_name(company_name)
        if not company_id:
            print(
                f"[ERROR] Company '{company_name}' not found in DB, skipping {project}."
            )
            continue

        # Check for existing document
        existing_doc = data_provider.documents.get_document_by_project(project)
        if existing_doc and existing_doc.content_hash == content_hash:
            print(f"[SKIP] {project}: No changes detected (hash match).")
            continue

        if existing_doc and existing_doc.content_hash != content_hash:
            # Delete existing chunks for this document before re-ingesting
            data_provider.chunks.delete_chunks_by_document_id(existing_doc.id)
            print(f"[DELETE] {project}: Removed existing chunks for re-ingestion.")

        # Create document model
        document = Document(
            content=content,
            content_hash=content_hash,
            company_id=company_id,
            tags=tags,
            project=project,
        )

        try:
            upserted_doc = data_provider.documents.upsert_document(document)
            print(f"[UPSERT] {project}: Document upserted.")
        except Exception as e:
            print(f"[ERROR] Upserting {project}: {e}")
            continue

        if not upserted_doc.id:
            print(
                f"[ERROR] Could not determine document ID for {project}, skipping chunk insert."
            )
            continue

        # Prepare chunk records for batch insert
        chunks_text = chunk_markdown(content)
        embeddings = embed_texts(chunks_text)
        chunk_models = []
        for chunk_text, embedding in zip(chunks_text, embeddings):
            chunk_models.append(
                Chunk(
                    content=chunk_text,
                    embedding=embedding,
                    tags=[],
                    document_id=upserted_doc.id,
                    type="markdown",
                )
            )

        if chunk_models:
            try:
                inserted_chunks = data_provider.chunks.insert_chunks(chunk_models)
                print(f"[CHUNKS] {project}: Inserted {len(inserted_chunks)} chunks.")
            except Exception as e:
                print(f"[ERROR] Exception during chunk insert for {project}: {e}")
        else:
            print(f"[CHUNKS] {project}: No chunks to insert.")
    print("Ingestion complete.")

# TODO: Implement these tests
def _test_ingest_new_document():
    """Test: Insert a new document and verify it appears in the DB."""
    # This is a stub. In a real test, you would use a test DB or mock supabase.
    print("[TEST] test_ingest_new_document: Manual verification required.")


def _test_skip_on_hash_match():
    """Test: Ingest same document twice, second time should skip."""
    print("[TEST] test_skip_on_hash_match: Manual verification required.")


def _test_update_on_hash_change():
    """Test: Change content, re-ingest, should update document."""
    print("[TEST] test_update_on_hash_change: Manual verification required.")


if __name__ == "__main__":
    # Determine Supabase target
    use_remote = "--remote" in sys.argv

    if "--test" in sys.argv:
        _test_ingest_new_document()
        _test_skip_on_hash_match()
        _test_update_on_hash_change()
    else:
        ingest_documents(use_remote)

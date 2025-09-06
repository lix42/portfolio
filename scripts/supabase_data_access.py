"""
Supabase implementation of the data access layer.
"""

from typing import List, Optional, Dict, Any
from supabase import Client
from data_access import (
    DataAccessProvider,
    CompanyRepository,
    DocumentRepository,
    ChunkRepository,
    Company,
    Document,
    Chunk
)


class SupabaseCompanyRepository(CompanyRepository):
    """Supabase implementation of company repository."""

    def __init__(self, client: Client):
        self._client = client

    def upsert_company(self, company: Company) -> Company:
        """Upsert a company record."""
        data = {
            "name": company.name,
            "start_time": company.start_time.isoformat() if company.start_time else None,
            "end_time": company.end_time.isoformat() if company.end_time else None,
            "title": company.title,
            "description": company.description,
        }
        
        resp = (
            self._client.table("companies")
            .upsert(data, on_conflict="name, start_time")
            .execute()
        )
        
        if hasattr(resp, 'status_code') and resp.status_code >= 400:
            raise RuntimeError(f"Failed to upsert company {company.name}: {resp}")
        
        # Return company with populated ID
        if hasattr(resp, "data") and resp.data:
            company.id = resp.data[0]["id"]
        return company

    def get_company_by_name(self, name: str) -> Optional[Company]:
        """Get company by name."""
        resp = (
            self._client.table("companies")
            .select("*")
            .eq("name", name)
            .execute()
        )
        
        if hasattr(resp, "data") and resp.data:
            row = resp.data[0]
            return Company(
                id=row["id"],
                name=row["name"],
                start_time=row.get("start_time"),
                end_time=row.get("end_time"),
                title=row["title"],
                description=row["description"]
            )
        return None

    def get_company_id_by_name(self, name: str) -> Optional[str]:
        """Get company ID by name."""
        resp = (
            self._client.table("companies")
            .select("id")
            .eq("name", name)
            .execute()
        )
        
        if hasattr(resp, "data") and resp.data:
            return resp.data[0]["id"]
        return None


class SupabaseDocumentRepository(DocumentRepository):
    """Supabase implementation of document repository."""

    def __init__(self, client: Client):
        self._client = client

    def upsert_document(self, document: Document) -> Document:
        """Upsert a document record."""
        data = {
            "content": document.content,
            "content_hash": document.content_hash,
            "company_id": document.company_id,
            "tags": document.tags,
            "project": document.project,
        }
        
        resp = (
            self._client.table("documents")
            .upsert(data, on_conflict="project")
            .execute()
        )
        
        if hasattr(resp, 'status_code') and resp.status_code >= 400:
            raise RuntimeError(f"Failed to upsert document {document.project}: {resp}")
        
        # Return document with populated ID
        if hasattr(resp, "data") and resp.data:
            row = resp.data[0]
            document.id = row["id"]
            document.created_at = row.get("created_at")
            document.updated_at = row.get("updated_at")
        return document

    def get_document_by_project(self, project: str) -> Optional[Document]:
        """Get document by project name."""
        resp = (
            self._client.table("documents")
            .select("*")
            .eq("project", project)
            .execute()
        )
        
        if hasattr(resp, "data") and resp.data:
            row = resp.data[0]
            return Document(
                id=row["id"],
                content=row["content"],
                content_hash=row["content_hash"],
                company_id=row["company_id"],
                tags=row.get("tags", []),
                project=row["project"],
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at")
            )
        return None

    def delete_document(self, document_id: str) -> None:
        """Delete a document by id."""
        resp = (
            self._client.table("documents")
            .delete()
            .eq("id", document_id)
            .execute()
        )
        
        if hasattr(resp, 'status_code') and resp.status_code >= 400:
            raise RuntimeError(f"Failed to delete document {document_id}: {resp}")


class SupabaseChunkRepository(ChunkRepository):
    """Supabase implementation of chunk repository."""

    def __init__(self, client: Client):
        self._client = client

    def insert_chunks(self, chunks: List[Chunk]) -> List[Chunk]:
        """Insert multiple chunks."""
        if not chunks:
            return chunks
            
        data = []
        for chunk in chunks:
            data.append({
                "content": chunk.content,
                "embedding": chunk.embedding,
                "tags": chunk.tags,
                "tags_embedding": chunk.tags_embedding,
                "document_id": chunk.document_id,
                "type": chunk.type,
            })
        
        resp = self._client.table("chunks").insert(data).execute()
        
        if hasattr(resp, 'status_code') and resp.status_code >= 400:
            raise RuntimeError(f"Failed to insert chunks: {resp}")
        
        # Update chunks with populated IDs
        if hasattr(resp, "data") and resp.data:
            for i, row in enumerate(resp.data):
                if i < len(chunks):
                    chunks[i].id = row["id"]
                    chunks[i].created_at = row.get("created_at")
                    chunks[i].updated_at = row.get("updated_at")
        
        return chunks

    def delete_chunks_by_document_id(self, document_id: str) -> None:
        """Delete all chunks for a given document id."""
        resp = (
            self._client.table("chunks")
            .delete()
            .eq("document_id", document_id)
            .execute()
        )
        
        if hasattr(resp, 'status_code') and resp.status_code >= 400:
            raise RuntimeError(f"Failed to delete chunks for document {document_id}: {resp}")

    def get_chunks_by_document_id(self, document_id: str) -> List[Chunk]:
        """Get all chunks for a given document id."""
        resp = (
            self._client.table("chunks")
            .select("*")
            .eq("document_id", document_id)
            .execute()
        )
        
        chunks = []
        if hasattr(resp, "data") and resp.data:
            for row in resp.data:
                chunks.append(Chunk(
                    id=row["id"],
                    content=row["content"],
                    embedding=row.get("embedding"),
                    tags=row.get("tags", []),
                    tags_embedding=row.get("tags_embedding"),
                    document_id=row["document_id"],
                    type=row["type"],
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at")
                ))
        
        return chunks


class SupabaseDataAccessProvider(DataAccessProvider):
    """Main Supabase data access provider."""

    def __init__(self, client: Client):
        self._client = client
        self._companies = SupabaseCompanyRepository(client)
        self._documents = SupabaseDocumentRepository(client)
        self._chunks = SupabaseChunkRepository(client)

    @property
    def companies(self) -> CompanyRepository:
        return self._companies

    @property
    def documents(self) -> DocumentRepository:
        return self._documents

    @property
    def chunks(self) -> ChunkRepository:
        return self._chunks
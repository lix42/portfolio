"""
Fake/Mock implementation of the data access layer for unit testing.

This implementation uses in-memory storage and provides the same interface
as the Supabase implementation, making it perfect for unit testing.
"""

from typing import List, Optional, Dict, Any
import uuid
from copy import deepcopy
from data_access import (
    DataAccessProvider,
    CompanyRepository,
    DocumentRepository,
    ChunkRepository,
    Company,
    Document,
    Chunk
)


class FakeCompanyRepository(CompanyRepository):
    """Fake implementation of company repository using in-memory storage."""

    def __init__(self):
        self._companies: Dict[str, Company] = {}  # id -> Company
        self._name_index: Dict[str, str] = {}     # name -> id

    def upsert_company(self, company: Company) -> Company:
        """Upsert a company record."""
        # Find existing company by name and start_time
        existing_id = None
        for cid, existing in self._companies.items():
            if (existing.name == company.name and 
                existing.start_time == company.start_time):
                existing_id = cid
                break
        
        if existing_id:
            # Update existing
            company.id = existing_id
        else:
            # Create new
            company.id = str(uuid.uuid4())
        
        # Store company
        company_copy = deepcopy(company)
        self._companies[company.id] = company_copy
        self._name_index[company.name] = company.id
        
        return deepcopy(company)

    def get_company_by_name(self, name: str) -> Optional[Company]:
        """Get company by name."""
        company_id = self._name_index.get(name)
        if company_id and company_id in self._companies:
            return deepcopy(self._companies[company_id])
        return None

    def get_company_id_by_name(self, name: str) -> Optional[str]:
        """Get company ID by name."""
        return self._name_index.get(name)

    def clear(self):
        """Clear all data (for testing)."""
        self._companies.clear()
        self._name_index.clear()


class FakeDocumentRepository(DocumentRepository):
    """Fake implementation of document repository using in-memory storage."""

    def __init__(self):
        self._documents: Dict[str, Document] = {}  # id -> Document
        self._project_index: Dict[str, str] = {}   # project -> id

    def upsert_document(self, document: Document) -> Document:
        """Upsert a document record."""
        # Find existing document by project
        existing_id = self._project_index.get(document.project)
        
        if existing_id:
            # Update existing
            document.id = existing_id
        else:
            # Create new
            document.id = str(uuid.uuid4())
        
        # Store document
        document_copy = deepcopy(document)
        self._documents[document.id] = document_copy
        self._project_index[document.project] = document.id
        
        return deepcopy(document)

    def get_document_by_project(self, project: str) -> Optional[Document]:
        """Get document by project name."""
        document_id = self._project_index.get(project)
        if document_id and document_id in self._documents:
            return deepcopy(self._documents[document_id])
        return None

    def delete_document(self, document_id: str) -> None:
        """Delete a document by id."""
        if document_id in self._documents:
            document = self._documents[document_id]
            # Remove from project index
            if document.project in self._project_index:
                del self._project_index[document.project]
            # Remove document
            del self._documents[document_id]

    def clear(self):
        """Clear all data (for testing)."""
        self._documents.clear()
        self._project_index.clear()


class FakeChunkRepository(ChunkRepository):
    """Fake implementation of chunk repository using in-memory storage."""

    def __init__(self):
        self._chunks: Dict[str, Chunk] = {}              # id -> Chunk
        self._document_index: Dict[str, List[str]] = {}  # document_id -> [chunk_ids]

    def insert_chunks(self, chunks: List[Chunk]) -> List[Chunk]:
        """Insert multiple chunks."""
        result = []
        for chunk in chunks:
            # Generate ID if not present
            if not chunk.id:
                chunk.id = str(uuid.uuid4())
            
            # Store chunk
            chunk_copy = deepcopy(chunk)
            self._chunks[chunk.id] = chunk_copy
            
            # Update document index
            if chunk.document_id not in self._document_index:
                self._document_index[chunk.document_id] = []
            if chunk.id not in self._document_index[chunk.document_id]:
                self._document_index[chunk.document_id].append(chunk.id)
            
            result.append(deepcopy(chunk))
        
        return result

    def delete_chunks_by_document_id(self, document_id: str) -> None:
        """Delete all chunks for a given document id."""
        if document_id in self._document_index:
            chunk_ids = self._document_index[document_id][:]
            for chunk_id in chunk_ids:
                if chunk_id in self._chunks:
                    del self._chunks[chunk_id]
            del self._document_index[document_id]

    def get_chunks_by_document_id(self, document_id: str) -> List[Chunk]:
        """Get all chunks for a given document id."""
        chunks = []
        chunk_ids = self._document_index.get(document_id, [])
        for chunk_id in chunk_ids:
            if chunk_id in self._chunks:
                chunks.append(deepcopy(self._chunks[chunk_id]))
        return chunks

    def clear(self):
        """Clear all data (for testing)."""
        self._chunks.clear()
        self._document_index.clear()


class FakeDataAccessProvider(DataAccessProvider):
    """Fake data access provider for testing."""

    def __init__(self):
        self._companies = FakeCompanyRepository()
        self._documents = FakeDocumentRepository()
        self._chunks = FakeChunkRepository()

    @property
    def companies(self) -> CompanyRepository:
        return self._companies

    @property
    def documents(self) -> DocumentRepository:
        return self._documents

    @property
    def chunks(self) -> ChunkRepository:
        return self._chunks

    def clear_all(self):
        """Clear all data (for testing)."""
        self._companies.clear()
        self._documents.clear()
        self._chunks.clear()
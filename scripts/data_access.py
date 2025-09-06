"""
Data Access Layer for Portfolio RAG Assistant

This module provides abstract interfaces and implementations for database operations,
making the code more testable by decoupling business logic from Supabase client.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import date, datetime
import uuid


@dataclass
class Company:
    """Company data model matching the companies table schema."""
    id: Optional[str] = None
    name: str = ""
    start_time: Optional[date] = None
    end_time: Optional[date] = None
    title: str = ""
    description: str = ""


@dataclass
class Document:
    """Document data model matching the documents table schema."""
    id: Optional[str] = None
    content: str = ""
    content_hash: str = ""
    company_id: str = ""
    tags: List[str] = None
    project: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class Chunk:
    """Chunk data model matching the chunks table schema."""
    id: Optional[str] = None
    content: str = ""
    embedding: Optional[List[float]] = None
    tags: List[str] = None
    tags_embedding: Optional[List[float]] = None
    document_id: str = ""
    type: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


class CompanyRepository(ABC):
    """Abstract repository for company operations."""

    @abstractmethod
    def upsert_company(self, company: Company) -> Company:
        """Upsert a company record. Returns the company with populated id."""
        pass

    @abstractmethod
    def get_company_by_name(self, name: str) -> Optional[Company]:
        """Get company by name. Returns None if not found."""
        pass

    @abstractmethod
    def get_company_id_by_name(self, name: str) -> Optional[str]:
        """Get company ID by name. Returns None if not found."""
        pass


class DocumentRepository(ABC):
    """Abstract repository for document operations."""

    @abstractmethod
    def upsert_document(self, document: Document) -> Document:
        """Upsert a document record. Returns the document with populated id."""
        pass

    @abstractmethod
    def get_document_by_project(self, project: str) -> Optional[Document]:
        """Get document by project name. Returns None if not found."""
        pass

    @abstractmethod
    def delete_document(self, document_id: str) -> None:
        """Delete a document by id."""
        pass


class ChunkRepository(ABC):
    """Abstract repository for chunk operations."""

    @abstractmethod
    def insert_chunks(self, chunks: List[Chunk]) -> List[Chunk]:
        """Insert multiple chunks. Returns the chunks with populated ids."""
        pass

    @abstractmethod
    def delete_chunks_by_document_id(self, document_id: str) -> None:
        """Delete all chunks for a given document id."""
        pass

    @abstractmethod
    def get_chunks_by_document_id(self, document_id: str) -> List[Chunk]:
        """Get all chunks for a given document id."""
        pass


class DataAccessProvider(ABC):
    """Main data access provider that combines all repositories."""

    @property
    @abstractmethod
    def companies(self) -> CompanyRepository:
        """Get company repository."""
        pass

    @property
    @abstractmethod
    def documents(self) -> DocumentRepository:
        """Get document repository."""
        pass

    @property
    @abstractmethod
    def chunks(self) -> ChunkRepository:
        """Get chunk repository."""
        pass
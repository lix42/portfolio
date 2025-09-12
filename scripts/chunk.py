from langchain.text_splitter import MarkdownHeaderTextSplitter
import tiktoken
from nltk.tokenize import sent_tokenize
import nltk
from config import MODEL, CHUNK_MAX_TOKENS
from generate_tags import batch_generate_tags
from data_access import DataAccessProvider, Chunk
from embedding import embed_texts

__all__ = ["ingest_chunks"]


def _build_chunk_context_header(metadata: dict, part: int = None) -> str:
    """
    Builds a context header string from metadata (h1, h2, h3), optionally appending a part number.
    Example: "Project Title\nSection\nSubsection - part 2"
    """
    header = "\n".join(metadata[k] for k in ["h1", "h2", "h3"] if k in metadata)
    if part is not None:
        header += f" - part {part}"
    return header


def _chunk_text_by_sentences(
    text: str, max_tokens: int = CHUNK_MAX_TOKENS
) -> list[str]:
    """
    Splits the input text into chunks based on sentences, ensuring that each chunk
    does not exceed the specified maximum number of tokens.

    Args:
        text (str): The input text to be chunked.
        max_tokens (int, optional): The maximum number of tokens allowed per chunk. Defaults to 800.

    Returns:
        list[str]: A list of text chunks, each containing one or more sentences and not exceeding max_tokens.
    """
    # Initialize the tokenizer for the specified model
    enc = tiktoken.encoding_for_model(MODEL)
    # Download the NLTK 'punkt' tokenizer data (if not already present)
    nltk.download("punkt")
    # Split the text into sentences
    sentences = sent_tokenize(text)

    chunks = []  # List to store the resulting chunks
    current_chunk = []  # List to accumulate sentences for the current chunk
    current_tokens = 0  # Token count for the current chunk

    for sentence in sentences:
        tokens = len(enc.encode(sentence))
        # If adding this sentence would exceed the max_tokens, start a new chunk
        if current_tokens + tokens > max_tokens:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_tokens = tokens
        else:
            current_chunk.append(sentence)
            current_tokens += tokens
    # Add any remaining sentences as the last chunk
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks


def _chunk_markdown(
    markdown_text: str, max_tokens: int = CHUNK_MAX_TOKENS
) -> list[str]:
    """
    Splits a Markdown document into context-aware text chunks suitable for embedding or storage.

    This function first splits the Markdown text into sections based on header levels (h1, h2, h3).
    For each section, it prepends a context header (built from the section's header metadata) to the content.
    If the resulting chunk exceeds the specified max_tokens, the section content is further split into
    smaller sentence-based chunks, each with a part number appended to the header.

    Args:
        markdown_text (str): The full Markdown document to be chunked.
        max_tokens (int, optional): The maximum number of tokens allowed per chunk. Defaults to 800.

    Returns:
        list[str]: A list of context-rich text chunks, each not exceeding max_tokens.
    """
    result = []
    # Split the markdown into sections using header levels (h1, h2, h3)
    splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")]
    )
    # Use the model-specific encoding for token counting
    enc = tiktoken.encoding_for_model(MODEL)
    docs = splitter.split_text(markdown_text)

    for doc in docs:
        # Build a context header from the section's metadata
        header = _build_chunk_context_header(doc.metadata)
        # Combine the header and the section content
        content = f"{header}\n{doc.page_content}"
        # Tokenize the combined content
        tokens = enc.encode(content)
        # If the chunk is too large, split further by sentences
        if len(tokens) > max_tokens:
            # Split the section content into smaller sentence-based chunks
            chunks = _chunk_text_by_sentences(doc.page_content, max_tokens)
            for index, chunk in enumerate(chunks):
                # Add a part number to the header for each sub-chunk
                header = _build_chunk_context_header(doc.metadata, index + 1)
                result.append(f"{header}\n{chunk}")
        else:
            # If the chunk is within the token limit, add as is
            result.append(content)
    return result


def ingest_chunks(
    content: str,
    document_id: str,
    data_provider: DataAccessProvider,
    project: str,
) -> int:
    """
    Create chunks for the given content, generate embeddings, and insert them via the data provider.

    Args:
        content: The full source content to split into chunks.
        document_id: The ID of the document that owns these chunks.
        data_provider: Data access provider used to persist chunks.
        project: Project name for logging purposes.

    Returns:
        int: Number of chunks inserted.
    """
    # TEMP: chunk_type is hardcoded to "markdown" for now until we support more types
    chunk_type = "markdown"

    # Always delete existing chunks for this document before re-ingesting
    try:
        data_provider.chunks.delete_chunks_by_document_id(document_id)
        print(f"[DELETE] {project}: Removed existing chunks for re-ingestion.")
    except Exception as e:
        print(f"[WARN] {project}: Failed to delete existing chunks: {e}")

    chunks_text = _chunk_markdown(content)
    if not chunks_text:
        print(f"[CHUNKS] {project}: No chunks to insert.")
        return 0

    embeddings = embed_texts(chunks_text)
    # Generate tags for each chunk in token-aware batches
    chunk_tags: list[list[str]] = batch_generate_tags(chunks_text)

    chunk_models: list[Chunk] = []
    for index, (chunk_text, embedding) in enumerate(zip(chunks_text, embeddings)):
        chunk_models.append(
            Chunk(
                content=chunk_text,
                embedding=embedding,
                tags=chunk_tags[index] if index < len(chunk_tags) else [],
                document_id=document_id,
                type=chunk_type,
            )
        )

    try:
        inserted_chunks = data_provider.chunks.insert_chunks(chunk_models)
        print(f"[CHUNKS] {project}: Inserted {len(inserted_chunks)} chunks.")
        return len(inserted_chunks)
    except Exception as e:
        print(f"[ERROR] Exception during chunk insert for {project}: {e}")
        return 0



from langchain.text_splitter import MarkdownHeaderTextSplitter
import tiktoken
from nltk.tokenize import sent_tokenize
import nltk

nltk.download("punkt_tab")


def add_chunk_metadata(content: str, metadata: dict, optional: str = "") -> str:
    result = "\n".join(metadata[k] for k in ["h1", "h2", "h3"] if k in metadata)
    if optional:
        result += f" {optional}"
    return result + f"\n{content}"


def chunk_text_by_sentences(text: str, max_tokens: int = 300) -> list[str]:
    enc = tiktoken.encoding_for_model("gpt-4o")
    sentences = sent_tokenize(text)

    chunks = []
    current_chunk = []
    current_tokens = 0

    for sentence in sentences:
        tokens = len(enc.encode(sentence))
        if current_tokens + tokens > max_tokens:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_tokens = tokens
        else:
            current_chunk.append(sentence)
            current_tokens += tokens
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks


def chunk_markdown(markdown_text: str, max_tokens: int = 300) -> list[str]:
    result = []
    splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")]
    )
    enc = tiktoken.get_encoding("cl100k_base")
    docs = splitter.split_text(markdown_text)

    for doc in docs:
        content = add_chunk_metadata(doc.page_content, doc.metadata)
        tokens = enc.encode(content)
        if len(tokens) > max_tokens:
            chunks = chunk_text_by_sentences(doc.page_content, max_tokens)
            for index, chunk in enumerate(chunks):
                result.append(
                    add_chunk_metadata(chunk, doc.metadata, f"Chunk {index + 1}")
                )
        else:
            result.append(content)
    return result


# =====================
# Unit tests (run directly)
# =====================


def test_add_chunk_metadata():
    # All headers present, with optional
    metadata = {"h1": "# Title", "h2": "## Subtitle", "h3": "### Section"}
    content = "Body text."
    result = add_chunk_metadata(content, metadata, optional=" [opt]")
    assert result.startswith("# Title\n## Subtitle\n### Section [opt]\nBody text."), (
        "All headers + optional failed"
    )

    # Some headers missing, no optional
    metadata = {"h1": "# Title"}
    result = add_chunk_metadata(content, metadata)
    assert result.startswith("# Title\nBody text."), "Missing headers failed"

    # No headers, with optional
    metadata = {}
    result = add_chunk_metadata(content, metadata, optional=" [opt]")
    assert result.startswith(" [opt]\nBody text."), "No headers + optional failed"

    print("test_add_chunk_metadata passed.")


def test_chunk_text_by_sentences():
    # Short text, no chunking needed
    text = "This is a sentence. This is another."
    chunks = chunk_text_by_sentences(text, max_tokens=100)
    assert len(chunks) == 1, "Short text should be one chunk"

    # Long text, should chunk
    text = " ".join(["Sentence %d." % i for i in range(30)])
    chunks = chunk_text_by_sentences(text, max_tokens=10)  # Force small chunks
    assert len(chunks) > 1, "Long text should be chunked"

    # Edge: empty string
    chunks = chunk_text_by_sentences("", max_tokens=10)
    assert chunks == [], "Empty string should return empty list"

    print("test_chunk_text_by_sentences passed.")


def test_chunk_markdown():
    # Simple markdown with headers
    md = """
# Title
Some intro text.
## Subtitle
More text here.
### Section
Even more text.
"""
    chunks = chunk_markdown(md, max_tokens=100)
    assert any("# Title" in c for c in chunks), "Should include h1 header"
    assert any("## Subtitle" in c for c in chunks), "Should include h2 header"
    assert any("### Section" in c for c in chunks), "Should include h3 header"

    # Markdown with a long section to force chunking
    long_text = " ".join(["Sentence %d." % i for i in range(50)])
    md = f"# Title\n{long_text}"
    chunks = chunk_markdown(md, max_tokens=10)  # Force small chunks
    assert len(chunks) > 1, "Long markdown should be chunked"

    # Edge: empty markdown
    chunks = chunk_markdown("", max_tokens=10)
    assert chunks == [], "Empty markdown should return empty list"

    print("test_chunk_markdown passed.")


if __name__ == "__main__":
    print("Running unit tests for chunk.py...")
    test_add_chunk_metadata()
    test_chunk_text_by_sentences()
    test_chunk_markdown()
    print("All tests passed.")

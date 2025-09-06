from langchain.text_splitter import MarkdownHeaderTextSplitter
import tiktoken
from nltk.tokenize import sent_tokenize
import nltk

def build_chunk_context_header(metadata: dict, part: int = None) -> str:
    """
    Builds a context header string from metadata (h1, h2, h3), optionally appending a part number.
    Example: "Project Title\nSection\nSubsection - part 2"
    """
    header = "\n".join(metadata[k] for k in ["h1", "h2", "h3"] if k in metadata)
    if part is not None:
        header += f" - part {part}"
    return header


def chunk_text_by_sentences(text: str, max_tokens: int = 800) -> list[str]:
    enc = tiktoken.encoding_for_model("gpt-4o")
    nltk.download("punkt")
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


def chunk_markdown(markdown_text: str, max_tokens: int = 800) -> list[str]:
    result = []
    splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")]
    )
    enc = tiktoken.get_encoding("cl100k_base")
    docs = splitter.split_text(markdown_text)

    for doc in docs:
        header = build_chunk_context_header(doc.metadata)
        content = f"{header}\n{doc.page_content}"
        tokens = enc.encode(content)
        if len(tokens) > max_tokens:
            chunks = chunk_text_by_sentences(doc.page_content, max_tokens)
            for index, chunk in enumerate(chunks):
                header = build_chunk_context_header(doc.metadata, index + 1)
                result.append(f"{header}\n{chunk}")
        else:
            result.append(content)
    return result


# =====================
# Unit tests (run directly)
# =====================


def test_build_chunk_context_header():
    # All headers present, no part
    metadata = {"h1": "# Title", "h2": "## Subtitle", "h3": "### Section"}
    result = build_chunk_context_header(metadata)
    assert result == "# Title\n## Subtitle\n### Section", "All headers failed"

    # Some headers missing, no part
    metadata = {"h1": "# Title"}
    result = build_chunk_context_header(metadata)
    assert result == "# Title", "Missing headers failed"

    # All headers present, with part
    metadata = {"h1": "# Title", "h2": "## Subtitle", "h3": "### Section"}
    result = build_chunk_context_header(metadata, 2)
    assert result == "# Title\n## Subtitle\n### Section - part 2", (
        "Headers with part failed"
    )

    # No headers, with part
    metadata = {}
    result = build_chunk_context_header(metadata, 1)
    assert result == " - part 1", "No headers with part failed"

    print("test_build_chunk_context_header passed.")


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
    print(chunks)
    assert any("Title" in c for c in chunks), "Should include h1 header"
    assert any("Subtitle" in c for c in chunks), "Should include h2 header"
    assert any("Section" in c for c in chunks), "Should include h3 header"

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
    test_build_chunk_context_header()
    test_chunk_text_by_sentences()
    test_chunk_markdown()
    print("All tests passed.")

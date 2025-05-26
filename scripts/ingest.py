


import os
import json
import hashlib
import openai
import tiktoken
from supabase import create_client
from dotenv import load_dotenv
from glob import glob

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def chunk_text(text, chunk_size=300, overlap=50):
    enc = tiktoken.encoding_for_model("gpt-4")
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(len(tokens), start + chunk_size)
        chunk = enc.decode(tokens[start:end])
        chunks.append((chunk, start, end))
        start += chunk_size - overlap
    return chunks

# Load documents from JSON metadata
documents = []
for filepath in glob("documents/*.json"):
    with open(filepath, "r") as f:
        data = json.load(f)
    content_path = data.get("content")
    if content_path and os.path.exists(content_path):
        with open(content_path, "r") as f:
            content = f.read()
        documents.append({
            "project": data.get("project"),
            "tags": data.get("tags", []),
            "company": data.get("company"),
            "content": content
        })

# Process and ingest documents
for doc in documents:
    chunks = chunk_text(doc["content"])
    enc = tiktoken.encoding_for_model("gpt-4")
    tokens = enc.encode(doc["content"])

    # Get company_id
    company_id = None
    if doc["company"]:
        result = supabase.table("companies").select("id").eq("name", doc["company"]).limit(1).execute()
        if result.data:
            company_id = result.data[0]["id"]

    for chunk, start_token, end_token in chunks:
        chunk_hash = compute_hash(chunk)

        existing = supabase.table("documents").select("id").eq("chunk_hash", chunk_hash).execute()
        if existing.data:
            continue

        embedding = openai.Embedding.create(
            model="text-embedding-3-small",
            input=chunk
        )["data"][0]["embedding"]

        supabase.table("documents").insert({
            "content": chunk,
            "embedding": embedding,
            "chunk_hash": chunk_hash,
            "start_token": start_token,
            "end_token": end_token,
            "company_id": company_id,
            "project": doc["project"],
            "tags": doc["tags"]
        }).execute()

print("✅ Ingestion complete.")
# GEMINI.md

## Project Overview

This is a full-stack portfolio assistant that uses Retrieval-Augmented Generation (RAG) to answer questions based on your past work.

The project is a monorepo managed with pnpm workspaces. It consists of the following main components:

*   **Frontend (`apps/ui`):** A React and TanStack Start-based user interface for the chat assistant.
*   **Backend (`apps/service`):** A Hono-based API that handles requests from the frontend, interacts with the vector database, and communicates with the OpenAI API.
*   **Data Ingestion (`scripts`):** A set of Python scripts for ingesting data into the Supabase vector database.

**Key Technologies:**

*   **Frontend:** React, TanStack Start, TypeScript
*   **Backend:** Hono, TypeScript
*   **Vector Database:** Supabase with `pgvector`
*   **Embedding & LLM:** OpenAI
*   **Data Ingestion:** Python, LangChain, TikToken
*   **Package Manager:** pnpm

## Building and Running

### Development

To run the frontend and backend services in development mode, use the following command from the root of the project:

```bash
pnpm dev
```

This will start the `ui` and `service` applications concurrently.

### Building

To build the frontend and backend services for production, use the following command from the root of the project:

```bash
pnpm build
```

### Data Ingestion

The data ingestion scripts are located in the `scripts` directory. To run the ingestion process, first install the Python dependencies:

```bash
pip install -r requirements.txt
```

Then, run the ingestion scripts:

```bash
python scripts/ingest_companies.py
python scripts/ingest_documents.py
```

## Development Conventions

*   **Linting:** The project uses ESLint for linting the TypeScript code. To check for linting errors, run:

    ```bash
    pnpm lint
    ```

*   **Formatting:** The project uses Prettier for code formatting. To check for formatting errors, run:

    ```bash
    pnpm format:check
    ```

*   **Biome:** The project also uses Biome for linting and formatting. To check for Biome errors, run:

    ```bash
    pnpm biome
    ```

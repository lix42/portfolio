import type { OpenAPIV3_1 } from "openapi-types";

/**
 * OpenAPI specification metadata and configuration
 * Used by openAPIRouteHandler to generate /openapi.json
 */
export const openAPIConfig: Omit<
  Partial<OpenAPIV3_1.Document>,
  | "x-express-openapi-additional-middleware"
  | "x-express-openapi-validation-strict"
> = {
  info: {
    title: "Portfolio RAG Service API",
    version: "1.0.0",
    description: `
AI-powered Retrieval-Augmented Generation (RAG) service for answering questions about portfolio, work experience, and skills.

## Features
- 🤖 GPT-4 powered answers with context-aware responses
- 🔍 Hybrid search combining vector similarity and tag-based matching
- 📚 Semantic search with pgvector and OpenAI embeddings
- ⚡ Edge-optimized on Cloudflare Workers for low latency
- 🎯 Specialized in portfolio, projects, and professional experience queries

## How It Works
1. User submits a question via POST /v1/chat
2. System generates semantic tags and embeddings from the question
3. Hybrid search retrieves relevant context from portfolio documents
4. GPT-4 generates a contextual answer based on retrieved information
5. Response includes citations and references to source documents

## Rate Limits
Currently no rate limits enforced - use responsibly.
    `.trim(),
    contact: {
      name: "Portfolio Service Support",
      url: "https://github.com/lix42/portfolio",
    },
    license: {
      name: "MIT",
    },
  },
  servers: [
    {
      url: "https://chat-service-prod.{account}.workers.dev",
      description: "Production",
      variables: {
        account: {
          default: "your-account",
          description: "Your Cloudflare account subdomain",
        },
      },
    },
    {
      url: "https://chat-service-staging.{account}.workers.dev",
      description: "Staging",
      variables: {
        account: {
          default: "your-account",
          description: "Your Cloudflare account subdomain",
        },
      },
    },
    {
      url: "http://localhost:5173",
      description: "Local Development",
    },
  ],
  tags: [
    {
      name: "Health",
      description:
        "Service health and monitoring endpoints for uptime checks and version information",
    },
    {
      name: "Chat",
      description:
        "RAG-powered question answering endpoints for portfolio and experience queries",
    },
  ],
  externalDocs: {
    url: "https://github.com/lix42/portfolio",
    description: "Project repository and documentation",
  },
};

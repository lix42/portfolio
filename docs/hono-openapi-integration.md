# Hono OpenAPI Integration Design Spec & Execution Plan

**Project**: Portfolio RAG Service OpenAPI Integration
**Target**: `apps/service`
**Date**: 2025-11-12
**Status**: Draft for Review

---

## 1. Executive Summary

This document outlines the design and execution plan for integrating `hono-openapi` with Zod validation into the portfolio RAG service. The integration will provide automatic OpenAPI 3.0 specification generation, enhanced API documentation, and improved developer experience while maintaining backward compatibility with existing functionality.

**Key Benefits:**
- 📄 Automatic OpenAPI 3.0 specification generation
- 🔍 Interactive API documentation (Swagger UI/Scalar)
- 🛡️ Type-safe request/response validation with Zod
- 🤝 Improved API discoverability for consumers
- 🧪 Better testing capabilities with generated specs

---

## 2. Current State Analysis

### 2.1 Existing Architecture

**Framework**: Hono 4.9.9 on Cloudflare Workers
**Validation**: `@hono/zod-validator` (v0.7.3)
**Runtime**: Cloudflare Workers (serverless edge)

### 2.2 Current Endpoints

| Method | Path | Validation | Response Type |
|--------|------|------------|---------------|
| GET | `/v1/` | None | Text |
| GET | `/v1/health` | None | `HealthResponse` |
| POST | `/v1/chat` | Zod schema | `ChatResponse` |

### 2.3 Current Validation Approach

**POST /v1/chat** - Only endpoint with validation:
```typescript
// Current implementation (src/chat.ts)
import { zValidator } from '@hono/zod-validator';

const schema = z.object({
  message: z.string(),
});

chat.post('/', zValidator('json', schema), async (c) => {
  const { message } = c.req.valid('json');
  // ... processing
});
```

**Pain Points:**
- ❌ No OpenAPI documentation
- ❌ Manual API documentation maintenance required
- ❌ No standardized error response schemas
- ❌ Limited visibility into API contract
- ❌ No response validation (only input validation)

---

## 3. Design Goals

### 3.1 Primary Objectives

1. **Auto-generate OpenAPI 3.0 specification** from Zod schemas
2. **Maintain 100% backward compatibility** with existing API behavior
3. **Enhance type safety** with request AND response validation
4. **Provide interactive documentation** via Swagger UI or Scalar
5. **Minimize code changes** to existing route handlers
6. **Support future extensibility** (auth, rate limiting, versioning)

### 3.2 Non-Goals

- ❌ Breaking changes to existing API contracts
- ❌ Adding authentication (separate initiative)
- ❌ Response streaming modifications
- ❌ Rate limiting implementation

---

## 4. Proposed Architecture

### 4.1 Technology Stack

**Core Dependencies:**
- `hono-openapi` - OpenAPI middleware & spec generation
- `zod` (v3.25.76) - Already installed, no changes needed
- Remove: `@hono/zod-validator` (replaced by hono-openapi's validator)

**Optional Documentation UI:**
- `@scalar/hono-api-reference` OR `@hono/swagger-ui`

### 4.2 Integration Pattern

```typescript
import { validator as zValidator, resolver, describeRoute } from 'hono-openapi';
import { openAPIRouteHandler } from 'hono-openapi';

// Define schemas with OpenAPI metadata
const ChatRequestSchema = z.object({
  message: z.string().min(1).describe('User question about portfolio/experience'),
});

const ChatSuccessResponseSchema = z.object({
  answer: z.string().describe('AI-generated answer based on portfolio context'),
});

const ChatErrorResponseSchema = z.object({
  error: z.string().describe('Error message describing what went wrong'),
});

// Apply OpenAPI decorators to routes
app.post(
  '/chat',
  describeRoute({
    description: 'RAG-powered chat endpoint for portfolio queries',
    tags: ['Chat'],
    responses: {
      200: {
        description: 'Successful response with AI-generated answer',
        content: {
          'application/json': {
            schema: resolver(ChatSuccessResponseSchema),
          },
        },
      },
      400: {
        description: 'Invalid request (missing/invalid message)',
        content: {
          'application/json': {
            schema: resolver(ChatErrorResponseSchema),
          },
        },
      },
      500: {
        description: 'Server error during processing',
        content: {
          'application/json': {
            schema: resolver(ChatErrorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator('json', ChatRequestSchema),
  chatHandler, // Existing handler logic unchanged
);

// Generate OpenAPI spec endpoint
app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: 'Portfolio RAG Service API',
        version: '1.0.0',
        description: 'AI-powered Q&A service for portfolio and work experience queries',
      },
      servers: [
        { url: 'https://service.your-domain.workers.dev', description: 'Production' },
        { url: 'http://localhost:5173', description: 'Local Development' },
      ],
    },
  }),
);
```

### 4.3 File Structure Changes

```
apps/service/src/
├── index.ts                    # Add OpenAPI endpoint registration
├── chat.ts                     # Update validator import + describeRoute
├── health.ts                   # Add response schema + describeRoute
├── schemas/                    # NEW: Centralized schema definitions
│   ├── index.ts               # Re-export all schemas
│   ├── chat.schemas.ts        # Chat request/response schemas
│   ├── health.schemas.ts      # Health response schema
│   └── common.schemas.ts      # Shared error schemas
└── openapi/                    # NEW: OpenAPI configuration
    ├── config.ts              # OpenAPI metadata (title, version, servers)
    └── tags.ts                # API tag definitions
```

---

## 5. Detailed Implementation Plan

### Phase 1: Setup & Dependencies (Estimated: 30 minutes)

**Tasks:**
1. ✅ Install `hono-openapi` package
2. ✅ Remove `@hono/zod-validator` dependency
3. ✅ Create `src/schemas/` directory structure
4. ✅ Create `src/openapi/` directory structure

**Commands:**
```bash
cd apps/service
pnpm remove @hono/zod-validator
pnpm add hono-openapi
```

**Risk**: Minimal - additive changes only

---

### Phase 2: Schema Definition (Estimated: 45 minutes)

**2.1 Create Common Schemas** (`src/schemas/common.schemas.ts`)
```typescript
import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string().describe('Error message'),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

**2.2 Create Health Schemas** (`src/schemas/health.schemas.ts`)
```typescript
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  ok: z.boolean().describe('Service health status'),
  version: z.string().describe('Deployed version metadata'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

**2.3 Create Chat Schemas** (`src/schemas/chat.schemas.ts`)
```typescript
import { z } from 'zod';

export const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message too long')
    .describe('User question about portfolio, work experience, or skills'),
});

export const ChatSuccessResponseSchema = z.object({
  answer: z
    .string()
    .describe('AI-generated answer with context from portfolio documents'),
});

export const ChatErrorResponseSchema = z.object({
  error: z.string().describe('Error description'),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatSuccessResponse = z.infer<typeof ChatSuccessResponseSchema>;
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>;
```

**2.4 Create Schema Index** (`src/schemas/index.ts`)
```typescript
export * from './common.schemas';
export * from './health.schemas';
export * from './chat.schemas';
```

---

### Phase 3: OpenAPI Configuration (Estimated: 20 minutes)

**3.1 Create OpenAPI Config** (`src/openapi/config.ts`)
```typescript
import type { OpenAPIObjectConfig } from 'hono-openapi';

export const openAPIConfig: OpenAPIObjectConfig['documentation'] = {
  info: {
    title: 'Portfolio RAG Service API',
    version: '1.0.0',
    description: `
AI-powered Retrieval-Augmented Generation (RAG) service for answering questions about portfolio, work experience, and skills.

## Features
- 🤖 GPT-4 powered answers
- 🔍 Vector similarity search with pgvector
- 🏷️ Tag-based hybrid search
- ⚡ Edge-optimized on Cloudflare Workers

## Usage
Send a POST request to \`/v1/chat\` with a JSON body containing your question.
    `.trim(),
    contact: {
      name: 'API Support',
      url: 'https://github.com/your-username/portfolio',
    },
  },
  servers: [
    {
      url: 'https://service.your-domain.workers.dev',
      description: 'Production',
    },
    {
      url: 'https://staging-service.your-domain.workers.dev',
      description: 'Staging',
    },
    {
      url: 'http://localhost:5173',
      description: 'Local Development',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Service health and monitoring endpoints',
    },
    {
      name: 'Chat',
      description: 'RAG-powered question answering endpoints',
    },
  ],
};
```

---

### Phase 4: Route Migration (Estimated: 1 hour)

**4.1 Update Health Endpoint** (`src/health.ts`)

**Before:**
```typescript
import { Hono } from 'hono';

export const health = new Hono<{ Bindings: CloudflareBindings }>();

health.get('/', (c) => {
  const version = c.env.CF_VERSION_METADATA?.id || 'unknown';
  return c.json({ ok: true, version });
});

export type HealthResponse = { ok: boolean; version: string };
```

**After:**
```typescript
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { HealthResponseSchema } from './schemas';
import type { CloudflareBindings } from './global';

export const health = new Hono<{ Bindings: CloudflareBindings }>();

health.get(
  '/',
  describeRoute({
    description: 'Health check endpoint for monitoring service availability',
    tags: ['Health'],
    responses: {
      200: {
        description: 'Service is healthy',
        content: {
          'application/json': {
            schema: resolver(HealthResponseSchema),
          },
        },
      },
    },
  }),
  (c) => {
    const version = c.env.CF_VERSION_METADATA?.id || 'unknown';
    return c.json({ ok: true, version });
  },
);

// Export type (no change needed, but can now derive from schema)
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

**4.2 Update Chat Endpoint** (`src/chat.ts`)

**Before:**
```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const schema = z.object({
  message: z.string(),
});

chat.post('/', zValidator('json', schema), async (c) => {
  const { message } = c.req.valid('json');
  // ... handler logic
});
```

**After:**
```typescript
import { validator as zValidator, describeRoute, resolver } from 'hono-openapi';
import {
  ChatRequestSchema,
  ChatSuccessResponseSchema,
  ChatErrorResponseSchema,
} from './schemas';

chat.post(
  '/',
  describeRoute({
    description: 'Ask questions about portfolio, work experience, skills, and projects',
    summary: 'Chat with AI about portfolio',
    tags: ['Chat'],
    responses: {
      200: {
        description: 'Successfully generated answer',
        content: {
          'application/json': {
            schema: resolver(ChatSuccessResponseSchema),
          },
        },
      },
      400: {
        description: 'Invalid or missing message',
        content: {
          'application/json': {
            schema: resolver(ChatErrorResponseSchema),
          },
        },
      },
      500: {
        description: 'Internal server error during processing',
        content: {
          'application/json': {
            schema: resolver(ChatErrorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator('json', ChatRequestSchema),
  async (c) => {
    const { message } = c.req.valid('json');
    // ... existing handler logic (no changes needed)
  },
);
```

**4.3 Update Main Index** (`src/index.ts`)

Add OpenAPI endpoint BEFORE the basePath app (so it's accessible at root):

```typescript
import { openAPIRouteHandler } from 'hono-openapi';
import { openAPIConfig } from './openapi/config';

// Create main app (before basePath)
const main = new Hono<{ Bindings: CloudflareBindings }>();

// Create v1 app with basePath
const app = new Hono<{ Bindings: CloudflareBindings }>().basePath('/v1');

// Register v1 routes
app.route('/health', health);
app.route('/chat', chat);
app.get('/', (c) => c.text('Hono!!'));
app.notFound(/* ... */);
app.onError(/* ... */);

// Mount v1 app
main.route('/', app);

// Add OpenAPI spec endpoint at root level
main.get(
  '/openapi.json',
  openAPIRouteHandler(app, { documentation: openAPIConfig }),
);

// Export main app instead of app
export default class extends WorkerEntrypoint<CloudflareBindings>
  implements ChatServiceBinding
{
  async fetch(request: Request) {
    return main.fetch(request, this.env, this.ctx);
  }
  // ... RPC methods unchanged
}
```

---

### Phase 5: Documentation UI (Estimated: 30 minutes) - OPTIONAL

**Option A: Scalar UI** (Recommended - modern, beautiful)
```bash
pnpm add @scalar/hono-api-reference
```

```typescript
// src/index.ts
import { apiReference } from '@scalar/hono-api-reference';

main.get(
  '/docs',
  apiReference({
    theme: 'purple',
    spec: {
      url: '/openapi.json',
    },
  }),
);
```

**Option B: Swagger UI** (Classic, widely known)
```bash
pnpm add @hono/swagger-ui
```

```typescript
// src/index.ts
import { swaggerUI } from '@hono/swagger-ui';

main.get('/docs', swaggerUI({ url: '/openapi.json' }));
```

**Endpoints After Integration:**
- `/openapi.json` - Raw OpenAPI specification
- `/docs` - Interactive API documentation UI

---

### Phase 6: Testing & Validation (Estimated: 1 hour)

**6.1 Update Existing Tests**

Update imports in test files:
```typescript
// Before
import { zValidator } from '@hono/zod-validator';

// After
import { validator as zValidator } from 'hono-openapi';
```

**6.2 Add OpenAPI Spec Tests** (`src/index.test.ts`)
```typescript
describe('OpenAPI Integration', () => {
  it('should serve OpenAPI spec at /openapi.json', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);

    const spec = await res.json();
    expect(spec.openapi).toBe('3.0.0'); // or 3.1.0
    expect(spec.info.title).toBe('Portfolio RAG Service API');
    expect(spec.paths['/v1/chat']).toBeDefined();
  });

  it('should validate OpenAPI spec structure', async () => {
    const res = await app.request('/openapi.json');
    const spec = await res.json();

    // Validate required OpenAPI fields
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('info');
    expect(spec).toHaveProperty('paths');

    // Validate chat endpoint documentation
    const chatEndpoint = spec.paths['/v1/chat'].post;
    expect(chatEndpoint).toHaveProperty('requestBody');
    expect(chatEndpoint).toHaveProperty('responses');
    expect(chatEndpoint.responses['200']).toBeDefined();
  });
});
```

**6.3 Test Response Validation** (Optional - if adding response validation)
```typescript
describe('Response Validation', () => {
  it('should validate successful chat responses', async () => {
    // Mock successful response
    const res = await app.request('/v1/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const json = await res.json();

    // Should match ChatSuccessResponseSchema or ChatErrorResponseSchema
    expect(json).toHaveProperty('answer'); // or 'error'
  });
});
```

**6.4 Manual Testing Checklist**

```bash
# Start dev server
cd apps/service
pnpm dev

# Test endpoints
curl http://localhost:5173/openapi.json
curl http://localhost:5173/docs # (if UI installed)
curl http://localhost:5173/v1/health
curl -X POST http://localhost:5173/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your experience?"}'
```

---

## 6. Migration Strategy

### 6.1 Rollout Phases

**Phase 1: Development Integration** (Week 1)
- ✅ Install dependencies
- ✅ Create schemas and OpenAPI config
- ✅ Migrate routes one-by-one
- ✅ Add OpenAPI endpoint
- ✅ Run full test suite

**Phase 2: Documentation & Review** (Week 1-2)
- 📝 Add Scalar/Swagger UI
- 📝 Review generated OpenAPI spec
- 📝 Update README with new endpoints
- 📝 Team review & feedback

**Phase 3: Staging Deployment** (Week 2)
- 🚀 Deploy to staging environment
- 🧪 Integration tests against staging
- 📊 Validate OpenAPI spec accessibility

**Phase 4: Production Deployment** (Week 3)
- 🚀 Deploy to production
- 📊 Monitor for errors
- 📈 Track API documentation usage

### 6.2 Backward Compatibility Guarantee

**✅ Zero Breaking Changes:**
- All existing endpoints remain at same paths
- Request/response formats unchanged
- Validation behavior identical (Zod under the hood)
- Error responses maintain current format

**New Additions Only:**
- `/openapi.json` - New endpoint (non-breaking)
- `/docs` - New endpoint (optional, non-breaking)
- Response schemas - Purely for documentation (not enforced)

### 6.3 Rollback Plan

If issues arise:
1. **Quick Fix**: Remove `/openapi.json` and `/docs` routes (keep validators)
2. **Full Rollback**: `pnpm add @hono/zod-validator`, revert validator imports
3. **Validation**: Re-run test suite to confirm functionality

**Git Strategy:**
- Create feature branch: `feat/hono-openapi-integration`
- Commit each phase separately for granular rollback
- Merge to `main` only after staging validation

---

## 7. Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API changes | **Low** | High | Comprehensive test suite, gradual rollout |
| Performance degradation | **Low** | Medium | OpenAPI generation is opt-in endpoint, not per-request |
| Dependency conflicts | **Low** | Low | Pin versions, test in development first |
| Incomplete documentation | **Medium** | Low | Manual review of generated spec before production |
| Schema drift | **Medium** | Medium | Co-locate schemas with routes, enforce via CI |

**Critical Success Factors:**
- ✅ All existing tests pass after migration
- ✅ OpenAPI spec validates with official tools
- ✅ Zero customer-reported API issues post-deployment
- ✅ Documentation UI accessible and functional

---

## 8. Success Metrics

**Technical Metrics:**
- ✅ 100% test coverage maintained or improved
- ✅ Zero regression bugs reported
- ✅ OpenAPI spec passes validation
- ✅ Build time increase <10%

**Developer Experience Metrics:**
- 📈 API documentation views (track `/docs` visits)
- 📈 Reduced API support questions
- 📈 Faster onboarding for new consumers
- 📈 Improved API discoverability

**Quality Metrics:**
- 🛡️ Type safety improvements (request + response validation)
- 🧪 Better test coverage with schema-based tests
- 📄 Single source of truth for API contracts

---

## 9. Future Enhancements

After successful integration, consider:

1. **Response Validation** - Enforce response schemas at runtime (not just documentation)
2. **Schema Registry** - Centralized schema versioning across services
3. **Auto-generate TypeScript Client** - Use OpenAPI spec to generate typed clients
4. **API Versioning** - Support `/v2` with schema evolution
5. **Authentication Documentation** - Document auth flows in OpenAPI spec
6. **Rate Limiting** - Document rate limit headers in OpenAPI
7. **Webhooks** - Document webhook endpoints if added

---

## 10. Execution Timeline

**Estimated Total Time: 4-6 hours** (actual implementation)

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|--------------|
| 1. Setup | 30 min | None | Dependencies installed, folders created |
| 2. Schemas | 45 min | Phase 1 | All schemas defined & exported |
| 3. OpenAPI Config | 20 min | Phase 2 | Configuration file complete |
| 4. Route Migration | 1 hour | Phase 2-3 | All routes updated with OpenAPI decorators |
| 5. Documentation UI | 30 min | Phase 4 | Interactive docs accessible |
| 6. Testing | 1 hour | Phase 1-5 | All tests passing, new tests added |
| 7. Documentation | 30 min | Phase 6 | README updated, team notified |
| 8. Review & Deploy | 1 hour | Phase 7 | Staging deployment, validation |

**Total**: ~5.5 hours development + testing + deployment

---

## 11. Acceptance Criteria

**Must Have (MVP):**
- ✅ `/openapi.json` endpoint returns valid OpenAPI 3.0+ spec
- ✅ All existing tests pass without modification
- ✅ Chat endpoint documented with request/response schemas
- ✅ Health endpoint documented
- ✅ No breaking changes to API behavior
- ✅ Validation errors maintain same format

**Should Have:**
- ✅ Interactive documentation UI (`/docs`)
- ✅ Comprehensive schema descriptions
- ✅ Server URLs configured for all environments
- ✅ API tags for endpoint organization

**Nice to Have:**
- 🎯 Response validation enabled
- 🎯 Generated TypeScript types from schemas
- 🎯 OpenAPI spec validation in CI/CD
- 🎯 Automated client generation

---

## 12. References

**Documentation:**
- [Hono OpenAPI with Zod](https://honohub.dev/docs/openapi/zod)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.0)
- [Zod Documentation](https://zod.dev)
- [Scalar API Reference](https://github.com/scalar/scalar)

**Related Files:**
- `/apps/service/src/index.ts` - Main entry point
- `/apps/service/src/chat.ts` - Chat endpoint
- `/apps/service/src/health.ts` - Health endpoint
- `/apps/service/package.json` - Dependencies

---

## Appendix A: Example OpenAPI Output

<details>
<summary>Click to expand: Expected /openapi.json output</summary>

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Portfolio RAG Service API",
    "version": "1.0.0",
    "description": "AI-powered Retrieval-Augmented Generation (RAG) service..."
  },
  "servers": [
    {
      "url": "https://service.your-domain.workers.dev",
      "description": "Production"
    }
  ],
  "paths": {
    "/v1/health": {
      "get": {
        "tags": ["Health"],
        "description": "Health check endpoint for monitoring service availability",
        "responses": {
          "200": {
            "description": "Service is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "ok": { "type": "boolean" },
                    "version": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/v1/chat": {
      "post": {
        "tags": ["Chat"],
        "summary": "Chat with AI about portfolio",
        "description": "Ask questions about portfolio, work experience, skills, and projects",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "message": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 1000,
                    "description": "User question about portfolio..."
                  }
                },
                "required": ["message"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successfully generated answer",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "answer": { "type": "string" }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid or missing message",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "tags": [
    { "name": "Health", "description": "Service health and monitoring endpoints" },
    { "name": "Chat", "description": "RAG-powered question answering endpoints" }
  ]
}
```

</details>

---

**Document Status**: ✅ Ready for Review
**Next Steps**: Review with team → Approve → Execute Phase 1

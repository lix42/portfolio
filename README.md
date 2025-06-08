# 🧠 Portfolio RAG Assistant – Fullstack Project

This project powers an interactive portfolio assistant that uses Retrieval-Augmented Generation (RAG) to answer questions based on your past work. It's built with:

- **Frontend**: React + Vite (deployed to Vercel)
- **Backend**: Hono + TypeScript (deployed to Render/Fly.io)
- **Embedding + LLM**: OpenAI
- **Vector DB**: Supabase with `pgvector`
- **Data ingestion**: Python script with token chunking and hash-based deduplication

---

## 🗂️ Project Structure

```
.
├── backend/        # Hono TypeScript API
├── frontend/       # React chat UI
├── scripts/        # Python ingestion
├── supabase/       # SQL schema and RPC function
```

---

## 🚀 Deployment Steps

### 1. Supabase Setup

- Create a project at [https://supabase.com](https://supabase.com)
- Run the SQL in `supabase/init.sql`
- Enable Row-Level Security (RLS) if needed
- Get your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### 2. Backend (Hono + TypeScript)

#### Local dev
```bash
cd backend
npm install
cp .env.example .env  # or edit manually
npm run dev
```

#### Deploy to Render
1. Go to [render.com](https://render.com), create a new Web Service from GitHub
2. Set Build Command: `npm run build`
3. Start Command: `node build/index.js`
4. Add environment variables from `.env`

### 3. Frontend (React)

```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

Deploy to [Vercel](https://vercel.com):
- Set project root to `frontend/`
- Set API URL inside `App.jsx` (e.g. Render backend URL)

---

## 🧪 Ingest Content

### Prepare files

In `documents/*.json`, create one file per project:

```json
{
  "project": "AWS Honeycode",
  "tags": ["state management"],
  "company": "Amazon",
  "content": "./conflict-resolving-engine.md"
}
```

Each `content` path should point to a `.md` file with detailed content.

### Run ingestion

```bash
pip3 install -r requirements.txt
python ./scripts/ingest_companies.py
python ./scripts/ingest_documents.py
```

This will:
- Load JSON
- Chunk markdown into tokenized segments
- Embed via OpenAI
- Store unique chunks in Supabase

---

## 🔐 Environment Variables

Both backend and ingest script require:

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-role-key
```

---

## 📬 Contact

Built by Li Xu. For questions or ideas, open an issue or reach out directly.


import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { loadEnv } from 'hono/env'
import { encoding_for_model } from 'tiktoken-node'
import crypto from 'crypto'

type Env = {
  OPENAI_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

const encoder = encoding_for_model('gpt-4')

function chunkText(text: string, chunkSize = 300, overlap = 50): string[] {
  const tokens = encoder.encode(text)
  const chunks: string[] = []
  for (let start = 0; start < tokens.length; start += chunkSize - overlap) {
    const end = Math.min(tokens.length, start + chunkSize)
    chunks.push(encoder.decode(tokens.slice(start, end)))
  }
  return chunks
}

function computeHash(text: string) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

app.post('/rag', async (c) => {
  const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = loadEnv(c)
  const { question } = await c.req.json()

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question
  })
  const embedding = embeddingRes.data[0].embedding

  const { data: docs } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.78,
    match_count: 5
  })

  const context = docs?.map((d: any) => d.content).join('\n') ?? ''

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant answering questions about Li Xu’s work experience.' },
      { role: 'user', content: `Answer the following based on the context:\n\n${context}\n\nQuestion: ${question}` }
    ]
  })

  return c.json({ answer: response.choices[0].message.content })
})

export default app

import app from './index'
import { describe, expect, test } from 'vitest'

describe('Example', () => {
  test('GET /', async () => {
    const res = await app.request('http://localhost/')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-powered-by')).toBe('Hono')
  })
})
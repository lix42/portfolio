import React, { useState } from 'react'
import { marked } from 'marked'

export default function App() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!question.trim()) return
    const newMessages = [...messages, { role: 'user', content: question }]
    setMessages(newMessages)
    setQuestion('')
    setLoading(true)

    try {
      const res = await fetch('https://your-api.onrender.com/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: '❌ Error fetching response.' }])
    }

    setLoading(false)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 700, margin: '2em auto' }}>
      <h1>Ask Li Xu's Portfolio</h1>
      <div>
        {messages.map((msg, i) => (
          <div key={i} style={{ margin: '1em 0' }}>
            <strong>{msg.role === 'user' ? 'You' : 'Li Xu'}:</strong>
            <div
              dangerouslySetInnerHTML={{ __html: marked(msg.content || '') }}
              style={{ background: '#f9f9f9', padding: '0.5em', borderRadius: '5px' }}
            />
          </div>
        ))}
        {loading && <div style={{ fontStyle: 'italic' }}>⏳ Li is thinking...</div>}
      </div>
      <textarea
        rows="3"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask a question about Li's experience..."
        style={{ width: '100%', padding: '0.5em', marginTop: '1em' }}
      />
      <button
        onClick={send}
        disabled={loading}
        style={{
          padding: '0.5em 1em',
          marginTop: '1em',
          background: '#000',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Waiting...' : 'Ask'}
      </button>
    </div>
  )
}

import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // your API key
});

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body; // array of { role: 'user' | 'assistant', content: string }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      stream: true,
      messages,
    });

    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error during streaming:', error);
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Streaming Chat</title>
</head>
<body>
  <div id="chat"></div>

  <script>
    async function sendMessage(userMessage) {
      const chatDiv = document.getElementById('chat');
      chatDiv.innerHTML = '';

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            if (data === '[DONE]') {
              console.log('Done!');
              return;
            }

            chatDiv.innerText += data.text;
          }
        }
      }
    }

    sendMessage("Explain streaming ChatGPT answers.");
  </script>
</body>
</html>
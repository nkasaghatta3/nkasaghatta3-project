# Week 1 Capstone: React Application

### What You'll Build

You will build and deploy **Spoonful**, an end-to-end React recipe platform. You will also integrate an AI Recipe Assistant that calls an LLM API and displays streamed AI-generated content in the UI.

The Figma design and user stories are provided. Your job is to connect the frontend to the backend, add the AI streaming feature, and deliver a working, deployed product.

This capstone exercises routing, state management, TypeScript, and the full deployment pipeline. These are the same steps followed on a client engagement.

---

### Setup

- Clone the repo and navigate to `cd unit1-capstone`
- Remove the Git repo: `rm -rf .git`
- Initialise a new repo: `git init`
- Add and commit: `setup starter code`
- Add a GitHub remote to the local repo

---

## Step 1: Setup Backend

- [Backend commands reference](./backend/README.md)

Add your Anthropic API key to the backend `.env` file alongside your existing environment variables:

```
ANTHROPIC_API_KEY=your_api_key_here
```

> **No Anthropic key available?** Use a Gemini key instead — get one from [Google AI Studio](https://aistudio.google.com/apikey) and add it as `GEMINI_API_KEY` instead of `ANTHROPIC_API_KEY`. The AI Recipe Assistant endpoint you'll build in Step 3.5 automatically uses whichever key is present, and the frontend code is identical either way — you don't need to change anything else to switch providers.

> **Never commit your API key.** Confirm `.env` is in `.gitignore` before your first push.

---

## Step 2: Consult Design Docs

- [Design docs](./DESIGN.md)

---

## Step 3: Build the React Frontend

- **Connect to Your Backend:**
  Your React app must call and use all the API endpoints you have built.

- **Set Up Routing:**
  Implement routing for navigation between all major app sections/components. At minimum: `/`, `/recipes`, `/recipes/:id`, `/dashboard`, `/login`, and `/ai-assistant`.

- **Responsive Design:**
  Use CSS and Flexbox so your app looks good on mobile, tablet, and desktop.

- **Match the Figma Design:**
  Strive for a pixel-perfect implementation of the provided UI.

- **Component Testing:**
  Write tests for at least four different UI components.

- [React client command reference](./client/README.md)

---

## Step 3.5: Add the AI Recipe Assistant

Add a dedicated `/ai-assistant` route to Spoonful. This page lets users describe what ingredients they have or what kind of meal they want, and Claude streams back a recipe suggestion in real time — token by token, not all at once.

The API key lives on the backend. The frontend consumes the stream using the Fetch API.

### Backend — add the streaming endpoint

The backend already proxies requests to MongoDB. Add a streaming endpoint that proxies to an LLM.

This endpoint supports **either Claude or Gemini** — if `ANTHROPIC_API_KEY` is set in `backend/.env`, it uses Claude; otherwise, if `GEMINI_API_KEY` is set, it falls back to Gemini automatically. This matters if you don't have Anthropic API access available: set `GEMINI_API_KEY` instead and everything else in this capstone — including the frontend component below — works completely unchanged. The endpoint normalizes both providers' responses into the same event shape before sending them to the client, so the frontend never needs to know or care which provider actually generated the response.

Create `backend/routes/ai.js`:

```js
const express = require('express');
const router = express.Router();

const SYSTEM_PROMPT =
  'You are a helpful recipe assistant. When a user describes ingredients or a meal idea, suggest a clear, practical recipe with ingredients and steps. Be concise.';

router.post('/stream', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  if (!hasAnthropicKey && !hasGeminiKey) {
    return res.status(500).json({
      error:
        'No AI provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in backend/.env.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (hasAnthropicKey) {
      await streamFromClaude(prompt, res);
    } else {
      await streamFromGemini(prompt, res);
    }
    res.end();
  } catch (err) {
    console.error('AI stream error:', err);
    res.end();
  }
});

async function streamFromClaude(prompt, res) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'messages-2023-12-15',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const error = await upstream.text();
    throw new Error(`Claude API error: ${error}`);
  }

  // Claude's own SSE events already use the { type: 'content_block_delta',
  // delta: { text } } shape our frontend expects, so we can pipe the raw
  // bytes straight through with no transformation needed.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value));
  }
}

async function streamFromGemini(prompt, res) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  if (!upstream.ok) {
    const error = await upstream.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  // Gemini's SSE format is structurally different from Claude's, and a
  // single network chunk can contain a partial line or multiple lines —
  // we buffer and split on newlines to handle that correctly, then
  // re-emit each text delta in the SAME shape Claude's events use, so
  // the frontend's parsing code below needs zero changes regardless of
  // which provider actually generated the response.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // last element may be an incomplete line — keep it for the next chunk

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.replace(/^data:\s*/, '').trim();
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const event = { type: 'content_block_delta', delta: { text } };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch {
        // Incomplete or malformed chunk — skip
      }
    }
  }
}

module.exports = router;
```

Register the route in `backend/server.js` alongside your existing routes:

```js
app.use('/api/ai', require('./routes/ai'));
```

### Frontend — add the AI Assistant page

Create `client/src/pages/AIAssistant/AIAssistant.tsx`:

```tsx
import { useState } from 'react';

export default function AIAssistant() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponse('');
    setError('');

    try {
      const res = await fetch('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              setResponse((prev) => prev + parsed.delta.text);
            }
          } catch {
            // Incomplete chunk — continue
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>AI Recipe Assistant</h1>
      <p>Tell me what ingredients you have or what you feel like eating — I'll suggest a recipe.</p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. I have chicken, garlic, lemon, and pasta..."
          rows={4}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !prompt.trim()}>
          {isLoading ? 'Generating...' : 'Get Recipe'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {isLoading && !response && <p>Claude is thinking...</p>}

      {response && (
        <div aria-live="polite">
          <h2>Suggested Recipe</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{response}</pre>
        </div>
      )}
    </div>
  );
}
```

Add the route to your React Router setup alongside your existing routes:

```tsx
import AIAssistant from './pages/AIAssistant/AIAssistant';

// Inside your <Routes>:
<Route path="/ai-assistant" element={<AIAssistant />} />
```

Add a link to the AI Assistant in your navigation component so users can reach it from anywhere in the app.

> **Check your streaming works:** Submit a prompt and confirm the response appears token by token — text should build up progressively, not appear all at once. If it appears all at once, the `data:` line parsing in the while loop is not working — add a `console.log(chunk)` to see the raw chunks and check the format.

---

## Step 4: Deploy Your Application

Deploy your frontend to S3 with static website hosting. This is the same deployment flow used for React applications on client engagements.

### Build for production

```bash
# From the client/ directory
npm run build
```

Confirm the `dist/` folder is generated with no TypeScript errors before deploying.

### Create and configure your S3 bucket

```bash
# Create bucket — name must be globally unique
aws s3api create-bucket --bucket spoonful-[your-name] --region us-east-1

# Disable public access block
aws s3api delete-public-access-block --bucket spoonful-[your-name]

# Enable static website hosting
aws s3 website s3://spoonful-[your-name]/ --index-document index.html --error-document index.html

# Apply a public read policy
cat > policy.json << 'EOF'
{"Version":"2012-10-17","Statement":[{"Sid":"PublicRead","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::spoonful-[your-name]/*"}]}
EOF
aws s3api put-bucket-policy --bucket spoonful-[your-name] --policy file://policy.json
```

### Deploy

```bash
aws s3 sync dist/ s3://spoonful-[your-name] --delete
```

Your app is available at:

```
http://spoonful-[your-name].s3-website-us-east-1.amazonaws.com
```

> **Common issue:** Navigating directly to a route like `/recipes` returns a 404 on S3. Setting the error document to `index.html` (done above) fixes this — S3 falls back to serving your React app for any path it does not find, and React Router handles the rest.

### Submit a working URL

Make sure your deployed app is accessible and all main features work — including the AI assistant route — before submitting.

---

## Must-Have Checklist

> 🥉 Bronze — complete all must-haves requirements

- [ ] Backend supports full CRUD, all endpoints in use
- [ ] React app calls all backend endpoints
- [ ] Routing set up for all major routes including `/ai-assistant`
- [ ] Responsive CSS/Flexbox design
- [ ] Pixel-perfect Figma implementation
- [ ] Four or more tested React components
- [ ] AI Recipe Assistant page at `/ai-assistant` with working streaming — response renders token by token
- [ ] TypeScript interfaces defined for all component props
- [ ] API key (Anthropic or Gemini) stored in backend `.env` — never in client code or committed to Git
- [ ] Production build completes with no TypeScript errors
- [ ] Deployed to S3 with static website hosting enabled
- [ ] Public S3 URL submitted and accessible — all routes work including direct URL access

---

## Stretch Goals

> 🥈 Silver — complete one stretch goal
> 🥇 Gold — complete two stretch goals

- Add conversation history to the AI assistant — maintain prior messages and responses within the session so Claude has context for follow-up questions
- Add Playwright end-to-end tests
- Set up GitHub Actions or other CI/CD for automated builds and tests

---

## Tips for Success

- **Work in small steps:** Build and test each part before moving on. Get the backend streaming endpoint working with a tool like Postman or curl before connecting the frontend.
- **Test streaming before deployment:** Confirm the response renders token by token in development before building for production.
- **Stick to the blueprint:** The Figma file and user stories define your target for the recipe features.
- **Ask questions:** Don't spend too long blocked. Help is here if you need it.

# Unit 1 Capstone — Instructor Guide
## React: AI-Powered Application Deployed to S3

> **Environment:** Ubuntu / bash
> **✅ INSTRUCTOR CHECK** — checkpoints where you must verify learner progress before they continue
> **⚠️ COMMON ISSUE** — problems that come up repeatedly and how to fix them

---

## Before the Capstone Begins

Run this checklist with the full cohort at the start of Thursday morning. Do not let learners begin until every item is confirmed.

- [ ] Node.js and npm installed and working
- [ ] AWS CLI installed and configured with bootcamp credentials
- [ ] Git installed and GitHub account active
- [ ] VS Code installed
- [ ] Deloitte-authorised API key available
- [ ] Learners know their API key is for **backend** environment variables only — never hardcoded, and never placed in a `VITE_`-prefixed frontend variable (see the note in Step 2)

Verify Node and npm as a group:

```bash
node --version
npm --version
aws --version
```

---

## Step 1 — Clone the Starter Code

Learners clone the provided Spoonful starter repo — they are **not** scaffolding a new project from scratch. The starter already includes the `client/` and `backend/` folders referenced throughout the capstone README.

```bash
mkdir -p ~/bootcamp
cd ~/bootcamp
git clone <starter-repo-url> unit1-capstone
cd unit1-capstone
rm -rf .git
git init
git add .
git commit -m "setup starter code"
git branch -M main
git remote add origin https://github.com/[username]/unit1-capstone.git
git push -u origin main
```

Install dependencies for both halves of the app:

```bash
cd backend && npm install && cd ..
cd client && npm install && cd ..
```

Start both servers (in two separate terminal tabs/panes):

```bash
# Terminal 1
cd backend && npm run dev
```

```bash
# Terminal 2
cd client && npm run dev
```

> **✅ INSTRUCTOR CHECK:** Every learner must have a running dev server at `http://localhost:5173` (frontend) and a backend responding at `http://localhost:3000` before moving on. Walk the room and confirm. Do not proceed as a group until everyone has this working.

> **⚠️ COMMON ISSUE:** Port 5173 already in use. Fix: `npm run dev -- --port 5174`

---

## Step 2 — Environment Variables and Git

The API key goes in the **backend's** `.env` file — never the frontend's. This is the single most important security requirement in this capstone.

```bash
touch backend/.env
echo ".env" >> backend/.gitignore
```

Learners add to `backend/.env` in VS Code:

```
ANTHROPIC_API_KEY=their_api_key_here
```

> **If a learner doesn't have Anthropic API access:** have them use a Gemini key instead — free to obtain from [Google AI Studio](https://aistudio.google.com/apikey). They add `GEMINI_API_KEY=their_key_here` to `backend/.env` instead of `ANTHROPIC_API_KEY`. The backend endpoint built in Step 3 checks for `ANTHROPIC_API_KEY` first and automatically falls back to `GEMINI_API_KEY` if present instead — no other code changes are needed, and the frontend behaves identically either way. This is a reasonable substitution to approve on the spot; don't let API key availability block a learner from progressing.

> **✅ INSTRUCTOR CHECK:** Confirm `backend/.env` is in `backend/.gitignore` and does NOT appear in the GitHub repo after push. Check one learner's GitHub repo in the browser as a live demo for the group. If any learner has committed a key, have them rotate it immediately — at console.anthropic.com for an Anthropic key, or aistudio.google.com/apikey for a Gemini key.

> **⚠️ CRITICAL — DO NOT SKIP:** Do not let learners put either key in a frontend `.env` file or in any `VITE_`-prefixed variable. Vite bakes any `VITE_`-prefixed variable directly into the client JavaScript bundle — once deployed to a public S3 bucket in Step 9, anyone could open browser dev tools and read the key straight out of the compiled bundle. Whichever provider a learner uses, the key must only ever live in `backend/.env` and only ever be read server-side (`process.env.ANTHROPIC_API_KEY` or `process.env.GEMINI_API_KEY`), never client-side. This is not a style preference — it's the difference between a private key and a publicly leaked one.

---

## Step 3 — Add the AI Streaming Endpoint (Backend)

The backend already proxies requests for the recipe CRUD routes. Learners add one more route that proxies streaming requests to an LLM — the API key never leaves the server.

This endpoint supports either Claude or Gemini automatically, based on which key is present in `backend/.env` (see Step 2). Both providers' responses are normalized into the same event shape before being sent to the client, so the frontend component built in Step 5 works identically regardless of which provider a given learner is using — this matters for a cohort where some learners have Anthropic access and others are using Gemini as a substitute.

```bash
touch backend/routes/ai.js
```

```js
// backend/routes/ai.js
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
  // the frontend's parsing code needs zero changes regardless of which
  // provider actually generated the response.
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

Register the route in `backend/server.js` alongside the existing routes:

```js
app.use('/api/ai', require('./routes/ai'));
```

> **✅ INSTRUCTOR CHECK:** Have learners test this endpoint directly with `curl` before touching the frontend at all — this works identically regardless of which provider their `.env` is configured for:
> ```bash
> curl -N -X POST http://localhost:3000/api/ai/stream \
>   -H "Content-Type: application/json" \
>   -d '{"prompt": "I have chicken, garlic, and lemon"}'
> ```
> They should see raw streamed data appear in the terminal, and every event should read `"type":"content_block_delta"` regardless of provider. If this doesn't work, the frontend won't either — fix it here first.
>
> If a learner switched from Anthropic to Gemini partway through, have them confirm the `curl` output still shows `content_block_delta` events — if they instead see raw Gemini-shaped JSON (`candidates: [...]`), the normalization in `streamFromGemini` isn't being hit, which usually means `ANTHROPIC_API_KEY` is still set in their `.env` alongside `GEMINI_API_KEY` and the Claude branch is running instead. Have them remove the unused key entirely.

---

## Step 4 — TypeScript Interfaces First

Before writing the `AIAssistant` component, learners should think through its state shape. This satisfies the capstone's TypeScript requirement for the AI feature specifically.

```bash
mkdir -p client/src/pages/AIAssistant
```

Encourage learners to sketch out the shape of their component's state before writing JSX — for example, what does a successful streamed response look like versus an error state? This doesn't need to be a separate file; inline `useState<string>` and `useState<boolean>` calls are sufficient for this component, but the thinking should happen before the code.

> **✅ INSTRUCTOR CHECK:** Ask at least two learners to explain their state variables out loud before they start building the component. If they can't explain what each piece of state represents, they're not ready to write the component yet.

---

## Step 5 — Build the AIAssistant Component (Core Requirement)

This is the most technically complex part of the capstone. Walk through the streaming logic with the whole cohort before learners build independently.

```bash
touch client/src/pages/AIAssistant/AIAssistant.tsx
```

```tsx
// client/src/pages/AIAssistant/AIAssistant.tsx
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
      if (!res.body) throw new Error('Response body is null');

      const reader = res.body.getReader();
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

Add the route alongside the app's existing routes:

```tsx
import AIAssistant from './pages/AIAssistant/AIAssistant';

// Inside your <Routes>:
<Route path="/ai-assistant" element={<AIAssistant />} />
```

Add a link to the AI Assistant in the navigation component so users can reach it from anywhere in the app.

> **✅ INSTRUCTOR CHECK:** Submit a prompt and watch the response appear. Text should build up progressively — token by token. If it appears all at once, streaming is not working. Add `console.log(chunk)` inside the while loop to inspect raw chunks and debug the `data:` line parsing.

> **⚠️ COMMON ISSUE:** `res.body` is null. The code above already guards against this with an explicit check — if learners copy this pattern into other fetch calls, remind them to keep the check.

> **⚠️ COMMON ISSUE:** CORS error in the browser console. Since the frontend now calls its own backend (not Anthropic or Gemini directly), this should not occur — if it does, confirm the backend has `cors()` middleware enabled and the frontend is hitting `localhost:3000`, not an external AI provider's API directly. A learner hitting a provider's API directly from the browser is a sign Step 2's key-placement rule wasn't followed — send them back to fix that first.

---

## Step 6 — TypeScript Verification and Production Build

```bash
# From the client/ directory
# Check for TypeScript errors without building
npx tsc --noEmit

# Build for production
npm run build
```

> **✅ INSTRUCTOR CHECK:** Every learner must run `npx tsc --noEmit` and see zero errors before building. A TypeScript error in source will fail the build. Common TypeScript errors at this stage: missing `?` on optional props, untyped event handlers, `useState` initialised with `null` but typed as the wrong type.

> **⚠️ COMMON ISSUE:** The AI assistant works locally but the backend URL is hardcoded to `localhost:3000`. This will break once deployed, since the deployed frontend has no backend running alongside it on S3 (S3 only serves static files). Flag this explicitly with learners — the backend needs to be reachable from wherever the deployed frontend expects it, which is a separate consideration from the frontend's own static deployment. Discuss this as a class if it isn't already addressed by the recipe CRUD API's existing configuration.

---

## Step 7 — S3 Bucket Setup

```bash
# Create bucket — name must be globally unique
aws s3api create-bucket --bucket unit1-capstone-[learner-name] --region us-east-1

# Disable public access block
aws s3api delete-public-access-block --bucket unit1-capstone-[learner-name]

# Enable static website hosting — error document must also be index.html
aws s3 website s3://unit1-capstone-[learner-name]/ --index-document index.html --error-document index.html

# Create and apply public read policy
cat > policy.json << 'EOF'
{"Version":"2012-10-17","Statement":[{"Sid":"PublicRead","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::unit1-capstone-[learner-name]/*"}]}
EOF
aws s3api put-bucket-policy --bucket unit1-capstone-[learner-name] --policy file://policy.json
```

> **⚠️ COMMON ISSUE:** Navigating directly to `/ai-assistant` returns a 404 on S3. This is fixed by setting `--error-document index.html` — S3 falls back to serving the React app for any path it cannot find, and React Router handles the rest. Confirm this is set on every learner's bucket.

---

## Step 8 — Deploy

```bash
aws s3 sync client/dist/ s3://unit1-capstone-[learner-name] --delete
```

Site URL:
```
http://unit1-capstone-[learner-name].s3-website-us-east-1.amazonaws.com
```

> **✅ INSTRUCTOR CHECK (final):** Open every learner's deployed URL in a browser. Test: submit a prompt and confirm the streamed response appears token by token on the live deployed version — not just locally. Routing must work on direct URL access. Both `/` and `/ai-assistant` must be reachable.

> **⚠️ COMMON ISSUE:** Deployed site shows old version. Fix: re-run `npm run build` then re-sync with `--delete` flag.

---

## Step 9 — Claude Code Improvement Pass

Once the application is deployed, learners use Claude Code to improve one aspect of their application. This is a graded Bronze requirement.

Required documentation in their README:
1. Which aspect they asked Claude Code to improve
2. What Claude suggested
3. What they accepted, what they changed, what they rejected — and why
4. One thing Claude produced they did not understand at first, and how they resolved it

> **✅ INSTRUCTOR CHECK:** The documentation must show active interrogation of Claude's output — not passive acceptance. If a learner writes "Claude suggested X and I accepted it" with no further commentary, send it back. The point is demonstrating that they understood every change before accepting it.

---

## Evaluation Quick Reference

| Medal | Key Requirements |
|---|---|
| 🥉 Bronze | All checklist items above complete. Streaming works on deployed URL. API key never appears client-side. Claude Code section in README. |
| 🥈 Silver | Bronze + conversation history OR second API route OR TypeScript generics in a utility function |
| 🥇 Gold | Silver + token count display OR copy-to-clipboard OR full keyboard accessibility |

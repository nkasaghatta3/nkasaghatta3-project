import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";



type HistoryItem = {
  prompt: string;
  answer: string;
};

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

function AIAssistant() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || isLoading) {
      setError("Please enter a prompt before submitting.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResponse("");

    let fullText = "";
    let buffer = "";

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          errorBody?.error || `The server returned status ${res.status}.`,
        );
      }

      if (!res.body) {
        throw new Error("The response stream was unavailable.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      function processLine(line: string) {
        if (!line.startsWith("data:")) {
          return;
        }

        const payload = line.replace(/^data:\s*/, "").trim();

        if (!payload || payload === "[DONE]") {
          return;
        }

        try {
          const parsed = JSON.parse(payload);
          const text =
            parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";

          if (text) {
            fullText += text;
            setResponse(fullText);
          }
        } catch {
          return;
        }
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        lines.forEach(processLine);
      }

      buffer += decoder.decode();
      buffer
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach(processLine);

      if (!fullText) {
        throw new Error("The AI returned an empty response.");
      }

      setHistory((previous) =>
        [
          { prompt: trimmedPrompt, answer: fullText },
          ...previous,
        ].slice(0, 3),
      );
      setPrompt("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="ai-card">
      <p className="eyebrow">Spoonful AI</p>
      <h1>AI Assistant</h1>
      <p className="ai-intro">
        Ask for cooking ideas, substitutions, techniques, or recipe guidance.
      </p>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label htmlFor="ai-prompt">Your prompt</label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setError("");
          }}
          placeholder="Ask something about cooking..."
          rows={4}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Generating..." : "Ask the assistant"}
        </button>
      </form>

      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}

      {isLoading && !response && (
        <p className="ai-status" aria-live="polite">
          Gemini is thinking...
        </p>
      )}

      {response && (
        <section className="ai-response" aria-live="polite">
          <h2>Response</h2>
          <div className="ai-markdown">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {response}
  </ReactMarkdown>
</div>
        </section>
      )}

      {history.length > 0 && (
        <section className="ai-history">
          <h2>Recent history</h2>
          {history.map((item, index) => (
            <article className="history-item" key={`${item.prompt}-${index}`}>
              <h3>Q: {item.prompt}</h3>
              <p className="history-answer-label">A:</p>
<div className="history-markdown">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {item.answer}
  </ReactMarkdown>
</div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

export default AIAssistant;

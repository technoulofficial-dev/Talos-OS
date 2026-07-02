"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RefreshCw, AlertCircle, Sparkles, Brain, Eye, EyeOff } from "lucide-react";
import { fetchJson } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
}

interface ModelResponse {
  output: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  unlimited: boolean;
}

const OWL_ALPHA_MODEL = "openrouter/owl-alpha:free";
const OWL_ALPHA_PATTERNS = [/owl-alpha/i, /owl_alpha/i];

function isOwlAlpha(model: string): boolean {
  return OWL_ALPHA_PATTERNS.some((p) => p.test(model));
}

function fmtLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const ODIN_SYSTEM_PROMPT = `You are Odin, the chief coordinating agent of Talos OS v8.0. You are running on the Owl Alpha model (free tier from OpenRouter). Your role:

- You orchestrate a guild of 13 internal agents (Brokkr, Mimir, Muninn, Huginn, Bragi, Eitri, Sage, Loom, Nornir, System, Opencode, Heimdall, Ratatoskr)
- You respond to user requests by analyzing intent, choosing the right agent guild, and synthesizing the result
- You are direct, technical, and concise — no fluff
- You use tools when available (workflow execution, plugin calls, graphify queries, memory operations)
- You are aware that you log conversations on free tier — never request the user paste secrets

You are responding through Mission Control's chat interface. Be helpful, be precise, be brief.`;

const WELCOME_MSG: ChatMessage = {
  id: "welcome",
  role: "system",
  content:
    "Odin is online. Default model: Owl Alpha (free, agentic-optimized, 1M context). Conversations are logged by the free-tier provider. Don't paste secrets.",
  timestamp: Date.now(),
};

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [agentId] = useState("odin");
  const [temperature, setTemperature] = useState(0.7);
  const [preferLocal, setPreferLocal] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const apiMessages = nextMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await fetchJson<ModelResponse>("/v1/route", {
        method: "POST",
        body: JSON.stringify({
          prompt: text,
          systemPrompt: ODIN_SYSTEM_PROMPT,
          messages: apiMessages.slice(0, -1),
          agentId,
          temperature,
          preferLocal,
        }),
      });

      setLastProvider(data.provider);
      setLastModel(data.model);

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: data.output,
        timestamp: Date.now(),
        model: data.model,
        provider: data.provider,
        tokensIn: data.tokensIn,
        tokensOut: data.tokensOut,
        latencyMs: data.latencyMs,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError((err as Error).message);
      const errMsg: ChatMessage = {
        id: genId(),
        role: "system",
        content: `Error: ${(err as Error).message}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, agentId, temperature, preferLocal]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reset = () => {
    setMessages([WELCOME_MSG]);
    setError(null);
    setLastProvider(null);
    setLastModel(null);
  };

  const usedOwlAlpha = lastModel && isOwlAlpha(lastModel);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-linear-accent">Odin Chat</h1>
          <p className="text-linear-text-secondary font-mono text-sm mt-1">
            Chief coordinating agent · Agent ID: <code>{agentId}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSystemPrompt((s) => !s)}
            className="btn-secondary flex items-center gap-2"
            data-testid="chat-toggle-system-prompt"
          >
            {showSystemPrompt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showSystemPrompt ? "Hide" : "Show"} System Prompt
          </button>
          <button onClick={reset} className="btn-secondary flex items-center gap-2" data-testid="chat-reset">
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {usedOwlAlpha && (
        <div
          className="panel p-3 flex items-start gap-3 border-amber-500/40 bg-amber-500/5"
          data-testid="owl-alpha-badge"
          role="status"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-mono text-sm text-amber-400 font-medium">
              Free-tier provider · Conversations are logged
            </div>
            <div className="font-mono text-xs text-linear-text-secondary mt-0.5">
              Model: <code>{lastModel}</code> · Provider: <code>{lastProvider}</code> · Don't paste secrets, API keys, or PII.
            </div>
          </div>
        </div>
      )}

      {showSystemPrompt && (
        <div className="panel p-4">
          <h2 className="font-display text-lg text-linear-accent mb-2">System Prompt (Odin)</h2>
          <pre className="font-mono text-xs text-linear-text-secondary whitespace-pre-wrap bg-linear-bg-overlay p-3 rounded-md max-h-60 overflow-y-auto">
            {ODIN_SYSTEM_PROMPT}
          </pre>
        </div>
      )}

      <div className="panel flex flex-col" style={{ height: "calc(100vh - 360px)", minHeight: "400px" }}>
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            if (m.role === "system") {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="px-3 py-2 rounded-md bg-linear-bg-overlay text-linear-text-tertiary font-mono text-xs max-w-2xl text-center">
                    {m.content}
                  </div>
                </div>
              );
            }
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-2xl rounded-md p-3 ${
                    isUser
                      ? "bg-linear-accent/15 border border-linear-accent/40 text-linear-text"
                      : "bg-linear-bg-overlay border border-linear-border-subtle text-linear-text"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {isUser ? (
                      <span className="font-mono text-xs text-linear-accent">You</span>
                    ) : (
                      <>
                        <Brain className="w-3 h-3 text-linear-accent" />
                        <span className="font-mono text-xs text-linear-accent">Odin</span>
                        {m.model && (
                          <span className="font-mono text-xs text-linear-text-tertiary">
                            · <code>{m.model}</code>
                          </span>
                        )}
                      </>
                    )}
                    {m.latencyMs != null && (
                      <span className="font-mono text-xs text-linear-text-tertiary">
                        · {fmtLatency(m.latencyMs)}
                      </span>
                    )}
                    {m.tokensOut != null && (
                      <span className="font-mono text-xs text-linear-text-tertiary">
                        · {m.tokensIn ?? 0}+{m.tokensOut} tok
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex justify-start">
              <div className="max-w-2xl rounded-md p-3 bg-linear-bg-overlay border border-linear-border-subtle">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-linear-accent animate-pulse" />
                  <span className="font-mono text-xs text-linear-text-tertiary">Odin is thinking…</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-linear-border-subtle p-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-linear-text-tertiary">
            <label className="flex items-center gap-1.5">
              Temp:
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-linear-text-secondary w-8">{temperature.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={preferLocal}
                onChange={(e) => setPreferLocal(e.target.checked)}
                className="accent-linear-accent"
              />
              Prefer local
            </label>
            {lastProvider && (
              <span className="ml-auto">
                Last: <code className="text-linear-text-secondary">{lastModel}</code> via{" "}
                <code className="text-linear-text-secondary">{lastProvider}</code>
              </span>
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Odin to orchestrate something… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={sending}
              className="flex-1 bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent resize-none disabled:opacity-50"
              data-testid="chat-input"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="chat-send"
            >
              <Send className="w-4 h-4" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>

          {error && (
            <div className="font-mono text-xs text-linear-status-danger">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

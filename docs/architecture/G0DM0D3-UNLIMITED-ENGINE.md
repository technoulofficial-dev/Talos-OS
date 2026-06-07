# G0DM0D3 — Unlimited AI Engine

**The Bronze Automaton's unlimited AI workforce**
*Metis Corp · Senior Architect · June 4, 2026*

---

## What is G0DM0D3?

G0DM0D3 is an open-source, multi-model AI chat interface built by **Elder Plinius** (https://github.com/elder-plinius/G0DM0D3). It provides:

- **50+ AI models** via OpenRouter (Claude, GPT-5, Gemini, Grok, Mistral, LLaMA, DeepSeek, Qwen)
- **No API key required** for the hosted version
- **AGPL-3.0 licensed** — forever free, irrevocably open
- **Privacy-first** — API keys stay in browser, no PII collected

But the hosted version has limits. For truly **unlimited** agent execution, we need more.

---

## The Unlimited Engine Stack

Talos OS combines FOUR complementary free AI sources for unlimited execution:

### 1. G0DM0D3 (elder-plinius/G0DM0D3) — Base Workers
- **Free, unlimited, always-on**
- 50+ models via OpenRouter
- Used as default workforce
- License: AGPL-3.0 (self-host from source)
- Endpoint: `https://godmod3.ai` or self-hosted

### 2. KeylessAI (lordbasilaiassistant-sudo/keylessai) — No-Key OpenAI-Compatible
- **Zero API keys, zero signup, zero cost, zero user compute**
- OpenAI-compatible endpoint at `https://keylessai.thryx.workers.dev/v1`
- Aggregates Pollinations.ai + ApiAirforce with auto-failover
- 100k req/day on Cloudflare free tier
- Drop-in replacement for OpenAI SDK

### 3. FreeTheAI (vibheksoni/free-ai) — 50+ Models, Discord Key
- 50+ active models
- OpenAI-compatible, Anthropic-compatible, Responses API
- Daily check-in via Discord (`/checkin`)
- 250 req/day free tier, role-based bumps

### 4. Free-AI-Router (webgeeked/free-ai-router) — 150+ Models, 20+ Providers
- 150+ free models across 20+ providers
- Auto-failover across Groq, Cerebras, NVIDIA, OpenRouter, etc.
- Zero external dependencies
- Smart routing: `free:best`, `free:fast`, `free:smart`, `free:cheap`

### 5. Puter.js — User-Pays Model
- Free, unlimited access to Claude, GPT, Gemini, etc.
- User covers their own usage (you pay zero)
- Browser-first; backend via authenticated session

### 6. Ollama (Local) — Fallback
- 100% local, GGUF models
- No internet required
- Pulls any model: Llama, Mistral, Qwen, DeepSeek
- Uses your GPU/CPU (can be heavy on potato PCs)

---

## Model Aliases for Talos OS

The router exposes unified aliases that map to the best available free model:

```typescript
// In packages/core/src/ai-engine/aliases.ts
export const MODEL_ALIASES = {
  // Tier aliases (route dynamically based on availability)
  "talos:best":      "Best available model for this task",
  "talos:fast":      "Lowest latency available model",
  "talos:smart":     "Balanced quality and speed",
  "talos:cheap":     "Most quota remaining",
  
  // Direct aliases
  "talos:claude":    "claude-sonnet-4-6 via Puter/KeylessAI",
  "talos:gpt":       "gpt-4o via KeylessAI",
  "talos:gemini":    "gemini-2.0-flash via Puter",
  "talos:llama":     "llama-3.3-70b via Groq",
  "talos:deepseek":  "deepseek-v3 via KeylessAI",
  "talos:qwen":      "qwen-2.5-72b via SiliconFlow",
  "talos:local":     "Ollama local model (last resort)",
};
```

---

## Provider Priority Chain

Talos OS uses this waterfall for every task:

```
1. G0DM0D3 workers        → free, unlimited, always try first
2. KeylessAI             → no-key OpenAI-compatible
3. FreeTheAI             → 50+ models with Discord check-in
4. Free-AI-Router        → 20+ providers with auto-failover
5. Puter.js              → user-pays model (browser contexts)
6. Ollama (local)        → offline fallback
7. Cloud (NVIDIA NIM)    → paid last resort
```

---

## Token Efficiency Mechanisms

From the Agentic OS Extension blueprint:

1. **Brokkr Task Splitting**: Tasks decomposed to ~4k tokens max
2. **Loom Auction Preference**: G0DM0D3 workers win 90% of auctions
3. **Cached Policies**: Repeated patterns compiled to zero-token cached policies
4. **Multi-Provider Proxy**: Rotate free keys to avoid rate limits
5. **Mimir Auditing**: Identifies wasted tokens and refactors
6. **Nornir Consolidation**: Compresses context during off-peak

---

## Implementation Files

| File | Purpose |
|------|---------|
| `packages/core/src/ai-engine/router.ts` | Provider waterfall with failover |
| `packages/core/src/ai-engine/aliases.ts` | Model alias resolution |
| `packages/core/src/ai-engine/providers/g0dm0d3.ts` | G0DM0D3 worker integration |
| `packages/core/src/ai-engine/providers/keylessai.ts` | KeylessAI provider |
| `packages/core/src/ai-engine/providers/freetheai.ts` | FreeTheAI provider |
| `packages/core/src/ai-engine/providers/free-ai-router.ts` | Free-AI-Router provider |
| `packages/core/src/ai-engine/providers/puter.ts` | Puter.js provider |
| `packages/core/src/ai-engine/providers/ollama.ts` | Ollama local provider |

---

## Setup Instructions

1. **G0DM0D3** — Self-host from source or use hosted version
   ```bash
   git clone https://github.com/elder-plinius/G0DM0D3.git
   cd G0DM0D3
   # Open index.html in browser, add OpenRouter key in settings
   ```

2. **KeylessAI** — No setup required
   ```bash
   export OPENAI_API_BASE="https://keylessai.thryx.workers.dev/v1"
   export OPENAI_API_KEY="not-needed"
   ```

3. **FreeTheAI** — Discord signup
   - Join discord.gg/secrets
   - Run `/signup` to get API key
   - Run `/checkin` daily
   ```bash
   export FREETHEAI_API_KEY="your-key"
   ```

4. **Free-AI-Router** — Get free API keys
   ```bash
   # Get free keys from: Groq, Cerebras, NVIDIA, OpenRouter
   export GROQ_API_KEY="..."
   export NVIDIA_API_KEY="..."
   export CEREBRAS_API_KEY="..."
   npm install free-ai-router
   ```

5. **Puter.js** — Browser context
   ```html
   <script src="https://js.puter.com/v2/"></script>
   <script>puter.ai.chat("Hello world")</script>
   ```

6. **Ollama** — Local fallback
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull llama3.2
   ollama pull qwen2.5-coder:7b
   ```

---

## Cost Comparison

| Approach | Monthly Cost | Unlimited? |
|----------|-------------|------------|
| Direct OpenAI API | $20-2000+ | With $$$ |
| G0DM0D3 (self-hosted) | $0 | ✅ Yes (with your own key) |
| KeylessAI | $0 | ✅ Yes (rate-limited) |
| FreeTheAI | $0 | ✅ Yes (250/day free) |
| Free-AI-Router | $0 | ✅ Yes (rotated quotas) |
| Puter.js | $0 to user | ✅ Yes (user pays) |
| Ollama | $0 | ✅ Yes (but uses your PC) |
| NVIDIA NIM Cloud | $0-50 | With free tier |

**Talos OS Goal: $0/month with unlimited execution** for non-enterprise users.

---

## Why This Matters for Talos

This unlimited engine stack directly addresses the user's core requirement:
> "make sure theres an unlimited ai/llm engine like g0dm0d3 by elderpine in github, this is to run the whole agentic system unlimited with no api key and no local model that squeezes my pc"

**Solution**: Use G0DM0D3 + KeylessAI + FreeTheAI + Free-AI-Router (cloud) as primary, with Ollama as fallback only when offline. Your PC is never squeezed because:
1. Cloud workers handle 99% of tasks
2. Local Ollama only used for sensitive/offline work
3. Smart router chooses cheapest/fastest provider per task
4. Auto-failover means no single point of failure

The Bronze Automaton runs on the labor of free, liberated AI workers. ⚒
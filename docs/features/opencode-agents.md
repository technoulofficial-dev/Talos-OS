# opencode Subagents

> **Purpose:** 22 specialized subagents extending opencode's capabilities. Load this to understand which agent to use for which task.

## 1. What Are Subagents

Subagents are pre-configured specialized agents that opencode can delegate tasks to. Each has a specific focus area, step limit, and expertise. They're invoked with `@agent-name` in opencode.

## 2. All 22 Subagents

### Backend & Full-Stack

| Agent | Steps | Focus | When to Use |
|-------|-------|-------|-------------|
| `@backend-developer` | 20 | Server-side logic, APIs, data processing | API endpoints, database queries, server-side business logic |
| `@frontend-developer` | 20 | UI implementation, components, browser APIs | React components, CSS, client-side logic |
| `@fullstack-developer` | 25 | End-to-end feature development | Features spanning frontend + backend |
| `@websocket-engineer` | 12 | Real-time communication, WebSocket protocol | WebSocket servers, SSE, event-driven systems |

### Language Specialists

| Agent | Steps | Focus | When to Use |
|-------|-------|-------|-------------|
| `@typescript-pro` | 12 | TypeScript type system, generics, advanced patterns | Strict typing, utility types, declaration files |
| `@javascript-pro` | 12 | Modern JavaScript, ES modules, runtime optimization | ES2024+, async patterns, module systems |

### Framework Specialists

| Agent | Steps | Focus | When to Use |
|-------|-------|-------|-------------|
| `@react-specialist` | 12 | React 18+ hooks, state management, component design | React hooks, Suspense, server components |
| `@vue-expert` | 12 | Vue 3 composition API, reactivity, ecosystem | Vue 3, Pinia, Vue Router, Nuxt |
| `@angular-architect` | 12 | Angular modules, RxJS, enterprise-scale SPAs | Angular 15+, signals, standalone components |
| `@nextjs-developer` | 12 | Next.js App Router, SSR, RSC, deployment | Next.js 14+, server actions, App Router |

### DevOps & Infrastructure

| Agent | Steps | Focus | When to Use |
|-------|-------|-------|-------------|
| `@deployment-engineer` | 20 | Deployment strategies, blue-green, canary | Deployment automation, rollbacks |
| `@devops-engineer` | 15 | CI/CD pipelines, infrastructure | GitHub Actions, pipeline config |
| `@docker-expert` | 15 | Docker optimization, multi-stage builds | Dockerfiles, compose, security hardening |
| `@platform-engineer` | 15 | Internal developer platforms | Golden paths, self-service tooling |
| `@sre-engineer` | 15 | Site reliability, monitoring, incident response | SLIs/SLOs, observability, alerts |

### Code Quality

| Agent | Steps | Focus | When to Use |
|-------|-------|-------|-------------|
| `@code-reviewer` | 20 | Code review, security, performance | PR reviews, code quality checks |
| `@build-engineer` | 15 | Build system configuration | Webpack, Vite, esbuild, turbo config |
| `@dependency-manager` | 15 | Dependency updates, audit | CVE scanning, version updates |
| `@test-writer` | 15 | Test generation | Unit, integration, e2e tests |

### Documentation

| Agent | Steps | Focus | When to Use |
|-------|-------|-------|-------------|
| `@docs-writer` | 15 | Technical documentation | README, API docs, guides |
| `@git-workflow-manager` | 12 | Git workflow, branching strategy | Branching strategy, commit hygiene |
| `@technical-writer` | 15 | User guides, tutorials | Developer tutorials, knowledge base |

## 3. Step Limits

Step limits control how many tool calls a subagent can make per invocation:

| Steps | Agents |
|-------|--------|
| 25 | fullstack-developer |
| 20 | backend-developer, frontend-developer, deployment-engineer, code-reviewer |
| 15 | docker-expert, platform-engineer, sre-engineer, build-engineer, dependency-manager, docs-writer, technical-writer, test-writer |
| 12 | websocket-engineer, typescript-pro, javascript-pro, react-specialist, vue-expert, angular-architect, nextjs-developer, git-workflow-manager |

## 4. How to Invoke

```
# In opencode chat:
@backend-developer create a REST endpoint for user authentication
@docker-expert optimize the Dockerfile for smaller image size
@test-writer add tests for the workflow engine
@code-reviewer review the plugin system for security issues
```

## 5. Best Practices

| Task Type | Recommended Agent |
|-----------|-------------------|
| New feature (full-stack) | `@fullstack-developer` |
| API endpoint only | `@backend-developer` |
| React component only | `@frontend-developer` |
| Type safety issues | `@typescript-pro` |
| Docker optimization | `@docker-expert` |
| CI/CD pipeline | `@devops-engineer` |
| PR review | `@code-reviewer` |
| Write tests | `@test-writer` |
| Write documentation | `@docs-writer` |
| Git branching strategy | `@git-workflow-manager` |
| Dependency updates | `@dependency-manager` |
| Performance issues | `@sre-engineer` |

## 6. Configuration

Step limits are configured in `opencode.json`:

```json
{
  "agent": {
    "fullstack-developer": { "steps": 25 },
    "backend-developer": { "steps": 20 },
    "frontend-developer": { "steps": 20 },
    "docker-expert": { "steps": 15 },
    "test-writer": { "steps": 15 }
  }
}
```

## 7. Interaction with Skills

Subagents can load skills for domain-specific guidance. The skill loading discipline from AGENTS.md recommends:

| Task | Load Skill | Use Agent |
|------|-----------|-----------|
| Build feature | `feature-dev`, `code-architect` | `@fullstack-developer` |
| Review code | `code-review` | `@code-reviewer` |
| Write tests | `test-patterns` | `@test-writer` |
| Build MCP | `mcp-builder` | `@backend-developer` |
| Build UI | `frontend-design`, `talos-ui-patterns` | `@frontend-developer` |

## 8. Limitations

- Subagents run in isolated context (no shared state between invocations)
- Step limits prevent runaway tool usage
- Subagents cannot access the knowledge graph directly (use graphify tools)
- Subagents cannot modify opencode configuration
- For complex multi-step tasks, use the `Task` tool to launch subagents

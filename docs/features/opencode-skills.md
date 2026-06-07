# opencode Skills

> **Purpose:** Specialized instruction sets loaded on-demand for specific task types. Load this to understand which skill to use when.

## 1. What Are Skills

Skills are markdown files containing detailed instructions, workflows, and resources for specific tasks. They're loaded into the conversation context when a task matches their description. Skills don't execute code — they provide guidance for the agent to follow.

## 2. Skill Locations

| Location | Scope | Count |
|----------|-------|-------|
| `.opencode/skills/` | Project-level | 7 |
| `~/.cache/opencode/packages/opencode-power-pack/.../skills/` | Global (plugin) | 12 |
| `.agents/skills/` | Installed (supabase) | 2 |

## 3. Project Skills (.opencode/skills/)

### talos-architecture
- **Purpose:** Reference for Talos OS v8.0 architecture
- **Content:** Package structure, agent system, build chain, development phases
- **Load when:** Working on Talos OS core, understanding system architecture

### talos-ui-patterns
- **Purpose:** Talos OS Mission Control UI conventions
- **Content:** Component conventions, styling, design tokens
- **Load when:** Building or modifying UI components

### test-patterns
- **Purpose:** Test generation following project conventions
- **Content:** Unit, integration, and e2e testing patterns
- **Load when:** Writing tests for any package

### changelog-generate
- **Purpose:** Generate CHANGELOG.md from git history
- **Content:** Keep a Changelog format with Added, Changed, Deprecated, Removed, Fixed, Security
- **Load when:** Creating releases, generating changelogs

### ci-pipeline
- **Purpose:** Generate CI/CD pipeline config
- **Content:** Lint, test, build, deploy stages
- **Load when:** Setting up or modifying CI/CD

### dependency-audit
- **Purpose:** Scan dependencies for vulnerabilities
- **Content:** CVE scanning, outdated packages, license issues
- **Load when:** Auditing dependencies, security reviews

### git-release
- **Purpose:** Create consistent releases
- **Content:** Changelogs, version bumps, release notes
- **Load when:** Publishing releases

## 4. Global Skills (opencode-power-pack)

### code-architect
- **Purpose:** Design feature architecture before implementation
- **Content:** Codebase analysis, pattern matching, implementation blueprints
- **Load when:** Before building non-trivial features

### code-explorer
- **Purpose:** Deep codebase tracing and understanding
- **Content:** Execution path mapping, architecture layer analysis
- **Load when:** Understanding unfamiliar code

### code-review
- **Purpose:** Multi-agent PR review with confidence filtering
- **Content:** Bug detection, security analysis, convention violations
- **Load when:** Reviewing pull requests

### code-reviewer
- **Purpose:** Local code review for small changes
- **Content:** Confidence-based bug/security/quality reporting
- **Load when:** Reviewing unstaged diff or specific files

### feature-dev
- **Purpose:** 7-phase structured feature implementation
- **Content:** Exploration, clarification, architecture, implementation, quality
- **Load when:** Building new features methodically

### frontend-design
- **Purpose:** Production-grade frontend interfaces
- **Content:** Design quality rubric, accessible markup, creative code
- **Load when:** Building web components, pages, dashboards

### mcp-builder
- **Purpose:** Create MCP servers
- **Content:** Python FastMCP or Node/TypeScript MCP SDK patterns
- **Load when:** Building new MCP servers

### security-review
- **Purpose:** Focused security review of pending changes
- **Content:** High-confidence vulnerability detection
- **Load before:** Merging PRs

### skill-creator
- **Purpose:** Create new skills from scratch
- **Content:** SKILL.md format, description design, workflow conversion
- **Load when:** Creating reusable skills

### agents-md-improver
- **Purpose:** Audit and improve AGENTS.md quality
- **Content:** Quality rubric, targeted edits
- **Load when:** AGENTS.md may be stale

### agents-md-revise
- **Purpose:** Capture session learnings into AGENTS.md
- **Content:** Learning extraction, rule documentation
- **Load at:** End of productive sessions

### acpx
- **Purpose:** Headless ACP CLI for agent-to-agent communication
- **Content:** Prompt/exec/sessions workflows, queueing, permissions
- **Load when:** Managing inter-agent communication

## 5. Installed Skills (.agents/skills/)

### supabase
- **Purpose:** Supabase MCP workflows
- **Content:** Database, Auth, Edge Functions, Realtime, Storage
- **Load when:** Any Supabase-related task

### supabase-postgres-best-practices
- **Purpose:** Postgres performance optimization
- **Content:** Query optimization, schema design, configuration
- **Load when:** Writing or optimizing Postgres queries

## 6. Skill Loading Discipline

| Task Type | Skill to Load |
|-----------|---------------|
| Building a new feature | `feature-dev`, `code-architect` |
| Reading unfamiliar code | `code-explorer` |
| Reviewing PRs | `code-review` |
| Creating opencode config | `customize-opencode` |
| Creating reusable workflow | `skill-creator` |
| Building MCP server | `mcp-builder` |
| Building UI | `frontend-design`, `talos-ui-patterns` |
| Writing tests | `test-patterns` |
| Managing releases | `git-release`, `changelog-generate` |
| Auditing deps | `dependency-audit` |
| Ending a session | `agents-md-revise` |
| Auditing AGENTS.md | `agents-md-improver` |

## 7. How Skills Work

1. Agent recognizes task matches a skill description
2. Agent calls `skill` tool with skill name
3. Skill content is injected into conversation context
4. Agent follows the skill's instructions
5. Skill may reference scripts, templates, or files in its directory

## 8. Creating Custom Skills

Use the `skill-creator` skill to create new skills. Format:

```markdown
# Skill Name

> **Purpose:** One-line description

## 1. When to Use
## 2. Workflow
## 3. Resources
## 4. Examples
```

Place new skills in `.opencode/skills/<skill-name>/SKILL.md`.

## 9. Self-Feeding Pattern

Skills follow a self-feeding pattern:
- Load `agents-md-revise` at session end to capture learnings
- Load `agents-md-improver` to audit AGENTS.md quality
- Load `code-reviewer` after implementing features
- Load `security-review` before merging changes

This ensures the project rules stay accurate and the agent maintains quality.

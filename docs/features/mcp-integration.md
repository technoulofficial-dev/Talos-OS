# MCP Integration

Model Context Protocol (MCP) servers extend opencode with external tool capabilities. Talos OS configures six MCP servers for browser automation, persistent memory, GitHub access, UI generation, design systems, and database management.

## Purpose

MCP provides a standardized protocol for LLMs to interact with external services. Each MCP server runs as a local process (stdio transport), connects to opencode, and exposes tools that agents can invoke during conversations. Talos OS uses MCP to bridge the gap between the LLM context window and real-world services.

## Configured MCPs

### browser (Playwright)

```json
"browser": {
  "type": "local",
  "command": ["npx", "-y", "@playwright/mcp"],
  "enabled": true,
  "timeout": 30000
}
```

**Purpose:** Browser automation, screenshots, web testing.

**Tools exposed:** `browser_navigate`, `browser_click`, `browser_type`, `browser_screenshot`, `browser_snapshot`, `browser_evaluate`, `browser_network_requests`, and others.

**Use cases:**
- Capture screenshots of the Mission Control UI for visual regression
- Automate web testing workflows
- Scrape web content for research tasks
- Interact with web applications during development

**Setup:** No environment variables required. Playwright downloads browser binaries on first run.

### memory

```json
"memory": {
  "type": "local",
  "command": ["npx", "-y", "@modelcontextprotocol/server-memory"],
  "enabled": true,
  "timeout": 10000
}
```

**Purpose:** Persistent memory across sessions.

**Tools exposed:** Memory search, memory add, memory list operations.

**Use cases:**
- Store and retrieve information that persists across opencode sessions
- Maintain context about user preferences and project history
- Build a searchable knowledge base from conversations

**Setup:** No environment variables required. Stores data locally.

### github

```json
"github": {
  "type": "local",
  "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
  "enabled": true,
  "environment": {
    "GITHUB_TOKEN": "{env:GITHUB_TOKEN}"
  },
  "timeout": 15000
}
```

**Purpose:** GitHub API access for PRs, issues, and repository management.

**Tools exposed:** `create_pull_request`, `list_issues`, `create_issue`, `fork_repository`, `create_branch`, `push_files`, `search_repositories`, and others.

**Use cases:**
- Create pull requests from within opencode sessions
- List and manage GitHub issues
- Fork repositories and push changes
- Search GitHub for code and repositories

**Setup:**
1. Generate a GitHub Personal Access Token at https://github.com/settings/tokens
2. Set the environment variable: `export GITHUB_TOKEN=ghp_xxxxx`
3. The token is referenced in `opencode.json` via `{env:GITHUB_TOKEN}` interpolation

### magic (21st.dev)

```json
"magic": {
  "type": "local",
  "command": ["npx", "-y", "@21st-dev/magic@latest"],
  "enabled": true,
  "environment": {
    "TWENTY_FIRST_API_KEY": "{env:TWENTYFIRST_API_KEY}",
    "API_KEY": "{env:TWENTYFIRST_API_KEY}"
  },
  "timeout": 60000
}
```

**Purpose:** UI component generation using 21st.dev's design intelligence.

**Tools exposed:** `magic_component_builder`, `magic_component_inspiration`, `magic_component_refiner`.

**Use cases:**
- Generate polished React components from descriptions
- Get design inspiration for UI elements
- Refine and improve existing component styling
- Build accessible, production-grade interfaces

**Setup:**
1. Sign up at https://21st.dev
2. Obtain your API key
3. Set: `export TWENTYFIRST_API_KEY=your_key_here`

**Note:** The `timeout` is set to 60 seconds to allow for component generation, which involves AI processing.

### open-design

```json
"open-design": {
  "type": "local",
  "command": ["npx", "-y", "open-design-mcp@latest"],
  "enabled": false,
  "environment": {
    "OD_DAEMON_URL": "{env:OD_DAEMON_URL}"
  },
  "timeout": 30000,
  "_note": "Requires open-design desktop app (subscription). Disabled for now."
}
```

**Purpose:** Design system artifact extraction and token management.

**Tools exposed:** `od_*` tools for design token extraction, component export, and design system integration.

**Use cases:**
- Extract Linear design tokens for Tailwind configuration
- Export design system components
- Synchronize design tokens between the design tool and codebase

**Setup:**
1. Install the open-design desktop app (requires subscription)
2. The daemon starts on port 7456 automatically
3. Set: `export OD_DAEMON_URL=http://localhost:7456`

**Status:** Disabled — requires a paid subscription desktop app. Linear design tokens are already applied via `tokens/linear.json`.

### supabase

```json
"supabase": {
  "type": "local",
  "command": ["npx", "-y", "@supabase/mcp-server-supabase@latest"],
  "enabled": true,
  "environment": {
    "SUPABASE_ACCESS_TOKEN": "{env:SUPABASE_ACCESS_TOKEN}"
  },
  "timeout": 15000
}
```

**Purpose:** Database management, schema operations, and Supabase project control.

**Tools exposed:** Database queries, schema management, edge function deployment, authentication management.

**Use cases:**
- Run SQL queries against the Talos database
- Manage database migrations
- Deploy edge functions
- Monitor database performance

**Setup:**
1. Generate a Supabase Personal Access Token at https://supabase.com/dashboard/account/tokens
2. Set: `export SUPABASE_ACCESS_TOKEN=your_pat_here`

**Transport:** Uses stdio transport with PAT authentication (not remote OAuth). Remote MCP at `mcp.supabase.com` requires browser-based OAuth which is less reliable for agent automation.

## Configuration Structure

All MCPs are defined in `opencode.json` under the `mcp` key. Each entry follows this schema:

```json
{
  "mcp": {
    "<name>": {
      "type": "local",
      "command": ["npx", "-y", "<package-name>"],
      "enabled": true | false,
      "environment": {
        "VAR_NAME": "{env:HOST_ENV_VAR}"
      },
      "timeout": <milliseconds>,
      "_note": "Optional comment"
    }
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Must be `"local"` for stdio-based MCPs |
| `command` | string[] | Command to start the MCP server process |
| `enabled` | boolean | Whether the MCP is active (default: true) |
| `environment` | object | Environment variables passed to the process |
| `timeout` | number | Connection timeout in milliseconds |
| `_note` | string | Optional comment (ignored by opencode) |

**Environment variable interpolation:** Use `{env:VAR_NAME}` syntax in `opencode.json` to reference host environment variables. The value is resolved at connection time.

## Environment Variables

| Variable | MCP | Required | Description |
|----------|-----|----------|-------------|
| `GITHUB_TOKEN` | github | Yes | GitHub Personal Access Token |
| `TWENTYFIRST_API_KEY` | magic | Yes | 21st.dev API key |
| `OD_DAEMON_URL` | open-design | Yes | open-design daemon URL (default: `http://localhost:7456`) |
| `SUPABASE_ACCESS_TOKEN` | supabase | Yes | Supabase Personal Access Token |

Set these in your shell before starting opencode:

```powershell
# Windows PowerShell
$env:GITHUB_TOKEN = "ghp_xxxxx"
$env:TWENTYFIRST_API_KEY = "your_key"
$env:SUPABASE_ACCESS_TOKEN = "your_pat"
```

Or add them to a `.env` file (not committed to git).

## Adding New MCPs

To add a custom MCP server:

1. Find the MCP package on npm or build a custom one
2. Add the configuration to `opencode.json`:

```json
{
  "mcp": {
    "my-custom-mcp": {
      "type": "local",
      "command": ["npx", "-y", "my-custom-mcp-package"],
      "enabled": true,
      "environment": {
        "MY_API_KEY": "{env:MY_API_KEY}"
      },
      "timeout": 15000
    }
  }
}
```

3. Set the required environment variable in your shell
4. Restart opencode to load the new MCP

**Note:** opencode does not hot-reload `opencode.json`. You must restart opencode after changing MCP configuration.

## MCP Inventory

| MCP | Status | Tools |
|-----|--------|-------|
| browser (Playwright) | Enabled | Browser automation, screenshots |
| memory | Enabled | Persistent memory |
| github | Enabled | PRs, issues, repos |
| magic (21st.dev) | Enabled | UI component generation |
| open-design | Disabled | Design system artifacts |
| supabase | Enabled | Database management |

## Troubleshooting

### MCP not connecting

1. Check that the MCP package is installed: `npx -y <package-name>` should succeed
2. Verify environment variables are set: `echo $env:GITHUB_TOKEN`
3. Check the timeout — some MCPs need more time (magic uses 60s)
4. Look for errors in opencode's startup output

### Tools not appearing

1. Ensure `"enabled": true` in the MCP config
2. Restart opencode after config changes
3. Check the MCP server logs for startup errors

### Timeout errors

1. Increase the `timeout` value in the MCP config
2. Some MCPs download packages on first run — run `npx -y <package>` manually first
3. Check network connectivity for cloud-based MCPs

### Environment variable interpolation

The `{env:VAR_NAME}` syntax is opencode-specific. It resolves at connection time. If the variable is not set, the MCP will receive an empty string or fail to start.

### Permission issues (Windows)

If you encounter permission errors on Windows:
- Ensure PowerShell execution policy allows scripts: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
- Run `npx -y <package>` manually to trigger any initial setup

## Related Documentation

- [opencode-tools.md](./opencode-tools.md) — Custom tools extending opencode
- [opencode-agents.md](./opencode-agents.md) — Subagent configurations
- [opencode-skills.md](./opencode-skills.md) — Skill loading system

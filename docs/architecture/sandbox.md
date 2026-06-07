# Sandbox System

> **Purpose:** Docker-based untrusted code execution. Load this to understand how Talos OS safely executes untrusted code.

## 1. Purpose

The Sandbox provides isolated execution of untrusted code using Docker containers. It's used by the workflow engine's `code` node type and the plugin system's ACP `exec` operation.

## 2. Implementation

**File:** `packages/core/src/sandbox/sandbox.ts` (119 lines)

### Features

| Feature | Description |
|---------|-------------|
| Docker isolation | Each execution runs in a fresh container |
| No network | Network access disabled by default |
| Configurable | Language, timeout, memory limit, CPU limit |
| Auto-destroy | Container destroyed after execution |
| Multi-language | JavaScript, TypeScript, Python, Bash |

## 3. Execution Flow

```
executeCode(code, options)
  ├── Pull base image (if needed)
  ├── Create container with code mounted
  ├── Set resource limits (memory, CPU, timeout)
  ├── Start container
  ├── Capture stdout/stderr
  ├── Wait for completion or timeout
  ├── Destroy container
  └── Return result
```

## 4. Configuration

| Option | Default | Purpose |
|--------|---------|---------|
| `language` | `javascript` | Execution language |
| `timeout` | 30000ms | Maximum execution time |
| `memoryLimit` | 256MB | Maximum memory usage |
| `cpuLimit` | 0.5 | Maximum CPU cores |
| `networkAccess` | false | Allow network access |

## 5. Supported Languages

| Language | Runtime | Docker Image |
|----------|---------|--------------|
| JavaScript | Node.js | node:20-alpine |
| TypeScript | ts-node | node:20-alpine |
| Python | python3 | python:3.11-alpine |
| Bash | sh | alpine:latest |

## 6. Security

| Measure | Description |
|---------|-------------|
| No network | Containers have no network access |
| Read-only filesystem | Code mounted read-only |
| Resource limits | Memory and CPU capped |
| Timeout | Execution killed after timeout |
| Auto-destroy | Container removed after execution |
| No privileged | Containers run without privileges |

## 7. Integration

### Workflow Engine
- `code` node type executes code in sandbox
- Gated behind `TALOS_WORKFLOW_CODE_ENABLED` (default OFF)
- RCE prevention: code/condition nodes disabled by default

### Plugin System (ACP)
- `exec` operation executes code via sandbox
- Path traversal protection enforced
- Only allowed paths accessible

## 8. API Usage

```typescript
import { executeCode } from '@talos/core/sandbox';

const result = await executeCode('console.log("hello")', {
  language: 'javascript',
  timeout: 5000,
  memoryLimit: 128,
});

// result.output = "hello"
// result.exitCode = 0
```

## 9. Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `TimeoutError` | Execution exceeded timeout | Kill container, return timeout error |
| `MemoryError` | Memory limit exceeded | Kill container, return OOM error |
| `DockerError` | Docker not available | Return error with setup instructions |
| `SecurityError` | Code/condition disabled | Return error with env var instruction |

## 10. Testing

Sandbox tests verify:
- Code execution works for all languages
- Timeout enforcement works
- Memory limits work
- Container cleanup happens
- Security restrictions work

# Identity System

> **Purpose:** Persistent user identity across sessions. Load this to understand how user identity is generated, stored, and used.

## 1. Purpose

The identity system generates and persists a unique user ID across sessions. This ID is used by the Cortex (memory system) to associate Thread of Fate data with a specific user.

## 2. Implementation

**File:** `packages/core/src/identity/user.ts`

### Functions

| Function | Purpose |
|----------|---------|
| `getOrCreateUserIdentity()` | Generate UUID on first run, persist to `.talos/user.json`, return on subsequent runs |
| `getUserId()` | Get current user ID (returns cached value or loads from disk) |

### Storage

- **File:** `.talos/user.json`
- **Format:** `{ "id": "uuid-v4" }`
- **Generated:** On first call to `getOrCreateUserIdentity()`
- **Cached:** In-memory after first load

### Integration

- `sessionStart()` in `packages/core/src/rituals/session.ts` calls `getOrCreateUserIdentity()`
- Returns `userId` in `SessionStartResult`
- Cortex uses `userId` to load/save user-specific memory data

## 3. Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `TALOS_WORKSPACE_ROOT` | `process.cwd()` | Root directory for `.talos/user.json` |

## 4. Data Model

```typescript
// .talos/user.json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 5. Testing

Identity tests verify:
- First call generates UUID
- Subsequent calls return same UUID
- File persistence works
- In-memory cache works

## 6. ADR References

- **ADR-014:** `import.meta.url` + walk-up for path resolution (used to find `.talos/user.json`)

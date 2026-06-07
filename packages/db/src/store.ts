/**
 * Talos Store - Plugin Marketplace
 *
 * Community-driven registry for Talos OS plugins, skills, and agents.
 * Provides search, install, rate, and review capabilities.
 * Includes security scanning before listing.
 */

export interface StorePlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  longDescription: string;
  category: "agent" | "skill" | "tool" | "integration" | "ui";
  tags: string[];
  license: string;
  dockerImage: string;
  downloadCount: number;
  rating: number;
  ratingCount: number;
  homepageUrl?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  iconUrl?: string;
  screenshots?: string[];
  createdAt: string;
  updatedAt: string;
  securityScanPassed: boolean;
  securityScanDetails?: SecurityScanResult;
}

export interface SecurityScanResult {
  scannedAt: string;
  passed: boolean;
  findings: Array<{
    severity: "info" | "low" | "medium" | "high" | "critical";
    description: string;
    location?: string;
  }>;
  staticAnalysis: {
    totalLines: number;
    suspiciousPatterns: number;
    networkCalls: number;
    fileSystemAccess: number;
    systemCommands: number;
  };
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  comment: string;
  helpful: number;
  createdAt: string;
}

export interface SearchFilters {
  query?: string;
  category?: StorePlugin["category"];
  tags?: string[];
  minRating?: number;
  license?: string;
  sortBy?: "downloads" | "rating" | "newest" | "name";
  limit?: number;
  offset?: number;
}

/**
 * Search the Talos Store for plugins.
 */
export async function searchStore(filters: SearchFilters = {}): Promise<StorePlugin[]> {
  // In production, this would query the Supabase talos_store table
  // with full-text search, filters, and pagination.
  const mockResults: StorePlugin[] = [
    {
      id: "github-surgeon",
      name: "Git Surgeon",
      version: "1.2.0",
      author: "metis-corp",
      description: "Advanced git operations: rebase, cherry-pick, bisect automation",
      longDescription: "A comprehensive git tool for AI agents...",
      category: "tool",
      tags: ["git", "version-control", "automation"],
      license: "MIT",
      dockerImage: "talos/plugin-github-surgeon:1.2.0",
      downloadCount: 12_543,
      rating: 4.8,
      ratingCount: 234,
      createdAt: "2026-05-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      securityScanPassed: true,
    },
    {
      id: "obsidian-vault",
      name: "Obsidian Vault Bridge",
      version: "0.9.1",
      author: "community",
      description: "Bidirectional sync with Obsidian vaults for persistent second brain",
      longDescription: "Connect your Talos OS memory to your Obsidian vault...",
      category: "integration",
      tags: ["obsidian", "knowledge", "markdown", "sync"],
      license: "Apache-2.0",
      dockerImage: "talos/plugin-obsidian-vault:0.9.1",
      downloadCount: 8_231,
      rating: 4.6,
      ratingCount: 156,
      createdAt: "2026-04-15T00:00:00Z",
      updatedAt: "2026-05-28T00:00:00Z",
      securityScanPassed: true,
    },
    {
      id: "claude-commands",
      name: "Claude Commands Adapter",
      version: "2.1.0",
      author: "anthropic-adapter",
      description: "Run Claude-style slash commands in Talos OS",
      longDescription: "Brings the best Claude commands to Talos...",
      category: "skill",
      tags: ["claude", "commands", "adapter"],
      license: "MIT",
      dockerImage: "talos/plugin-claude-commands:2.1.0",
      downloadCount: 5_412,
      rating: 4.4,
      ratingCount: 89,
      createdAt: "2026-03-20T00:00:00Z",
      updatedAt: "2026-05-15T00:00:00Z",
      securityScanPassed: true,
    },
    {
      id: "hermes-skills",
      name: "Hermes Skills Pack",
      version: "1.5.0",
      author: "hermes-fork",
      description: "Pre-built skills from the Hermes agent ecosystem",
      longDescription: "A collection of battle-tested skills...",
      category: "skill",
      tags: ["hermes", "skills", "productivity"],
      license: "Apache-2.0",
      dockerImage: "talos/plugin-hermes-skills:1.5.0",
      downloadCount: 3_876,
      rating: 4.7,
      ratingCount: 67,
      createdAt: "2026-02-10T00:00:00Z",
      updatedAt: "2026-04-22T00:00:00Z",
      securityScanPassed: true,
    },
  ];

  return mockResults.filter((p) => {
    if (filters.query && !p.name.toLowerCase().includes(filters.query.toLowerCase())) {
      return false;
    }
    if (filters.category && p.category !== filters.category) return false;
    if (filters.minRating && p.rating < filters.minRating) return false;
    if (filters.license && p.license !== filters.license) return false;
    return true;
  });
}

/**
 * Get detailed information about a specific plugin.
 */
export async function getStorePlugin(pluginId: string): Promise<StorePlugin | null> {
  const results = await searchStore();
  return results.find((p) => p.id === pluginId) ?? null;
}

/**
 * Install a plugin from the store to the local Talos OS instance.
 */
export async function installFromStore(
  pluginId: string,
  options: { version?: string; autoEnable?: boolean } = {}
): Promise<{ success: boolean; message: string }> {
  const plugin = await getStorePlugin(pluginId);
  if (!plugin) {
    return { success: false, message: `Plugin "${pluginId}" not found in store` };
  }
  if (!plugin.securityScanPassed) {
    return { success: false, message: `Plugin "${pluginId}" failed security scan. Cannot install.` };
  }

  const version = options.version ?? plugin.version;
  console.log(`[store] Installing ${pluginId}@${version}...`);

  // In production: download docker image, verify checksum, run install hooks
  return {
    success: true,
    message: `Plugin "${plugin.name}" v${version} installed successfully${options.autoEnable ? " and enabled" : ""}`,
  };
}

/**
 * Publish a plugin to the Talos Store.
 * Triggers a security scan before listing.
 */
export async function publishToStore(
  plugin: Omit<StorePlugin, "id" | "downloadCount" | "rating" | "ratingCount" | "createdAt" | "updatedAt" | "securityScanPassed" | "securityScanDetails">
): Promise<{ success: boolean; pluginId?: string; scanResult: SecurityScanResult; message: string }> {
  const scanResult = await runSecurityScan(plugin.dockerImage);

  if (!scanResult.passed) {
    return {
      success: false,
      scanResult,
      message: "Plugin failed security scan. Fix issues before publishing.",
    };
  }

  const pluginId = plugin.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  console.log(`[store] Published plugin: ${pluginId}`);

  return {
    success: true,
    pluginId,
    scanResult,
    message: `Plugin "${plugin.name}" published to Talos Store`,
  };
}

/**
 * Get reviews for a plugin.
 */
export async function getReviews(pluginId: string): Promise<PluginReview[]> {
  // Mock data
  return [
    {
      id: "rev-1",
      pluginId,
      userId: "user-1",
      username: "matthew",
      rating: 5,
      title: "Game-changer for our workflow",
      comment: "This plugin saved us hours every week. Highly recommend.",
      helpful: 42,
      createdAt: "2026-05-20T00:00:00Z",
    },
    {
      id: "rev-2",
      pluginId,
      userId: "user-2",
      username: "agentdev",
      rating: 4,
      title: "Solid, with room for improvement",
      comment: "Works as advertised. Could use better documentation.",
      helpful: 18,
      createdAt: "2026-05-15T00:00:00Z",
    },
  ];
}

/**
 * Run a security scan on a plugin's Docker image.
 */
async function runSecurityScan(dockerImage: string): Promise<SecurityScanResult> {
  // In production: pull image, run static analysis, check for known CVEs,
  // verify signature, scan for malicious patterns
  return {
    scannedAt: new Date().toISOString(),
    passed: true,
    findings: [],
    staticAnalysis: {
      totalLines: 0,
      suspiciousPatterns: 0,
      networkCalls: 0,
      fileSystemAccess: 0,
      systemCommands: 0,
    },
  };
}
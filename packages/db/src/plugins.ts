/**
 * Plugins - manages the plugin registry and Talos Store in Supabase.
 * Tracks plugin versions, health, and activation state.
 */

import { getSupabaseClient } from "./client.js";

export interface PluginRecord {
  id?: string;
  name: string;
  version: string;
  dockerImage: string;
  configSchema?: Record<string, unknown>;
  healthEndpoint?: string;
  active: boolean;
  installedAt?: string;
  updatedAt?: string;
}

export interface PluginInstallInput {
  name: string;
  version: string;
  dockerImage: string;
  configSchema?: Record<string, unknown>;
  healthEndpoint?: string;
}

/**
 * Install a new plugin.
 */
export async function installPlugin(input: PluginInstallInput): Promise<PluginRecord> {
  const client = getSupabaseClient();

  // Check for existing plugin with same name
  const { data: existing } = await client
    .from("talos_plugins")
    .select("*")
    .eq("name", input.name)
    .single();

  if (existing) {
    throw new Error(
      `Plugin "${input.name}" is already installed (version ${existing.version}). Use updatePlugin() to upgrade.`
    );
  }

  const { data, error } = await client
    .from("talos_plugins")
    .insert({
      name: input.name,
      version: input.version,
      docker_image: input.dockerImage,
      config_schema: input.configSchema,
      health_endpoint: input.healthEndpoint,
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to install plugin: ${error.message}`);

  return mapPluginFromDb(data);
}

/**
 * Update a plugin to a new version.
 */
export async function updatePlugin(
  name: string,
  updates: { version: string; dockerImage?: string; configSchema?: Record<string, unknown> }
): Promise<PluginRecord> {
  const client = getSupabaseClient();

  const updateData: Record<string, unknown> = {
    version: updates.version,
    updated_at: new Date().toISOString(),
  };
  if (updates.dockerImage) updateData.docker_image = updates.dockerImage;
  if (updates.configSchema) updateData.config_schema = updates.configSchema;

  const { data, error } = await client
    .from("talos_plugins")
    .update(updateData)
    .eq("name", name)
    .select()
    .single();

  if (error) throw new Error(`Failed to update plugin: ${error.message}`);

  return mapPluginFromDb(data);
}

/**
 * Get a plugin by name.
 */
export async function getPlugin(name: string): Promise<PluginRecord | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_plugins")
    .select("*")
    .eq("name", name)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get plugin: ${error.message}`);
  }

  return mapPluginFromDb(data);
}

/**
 * List all installed plugins.
 */
export async function listPlugins(activeOnly: boolean = false): Promise<PluginRecord[]> {
  const client = getSupabaseClient();

  let query = client.from("talos_plugins").select("*");
  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list plugins: ${error.message}`);

  return (data ?? []).map(mapPluginFromDb);
}

/**
 * Deactivate a plugin (does not remove, just disables).
 */
export async function deactivatePlugin(name: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("talos_plugins")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("name", name);

  if (error) throw new Error(`Failed to deactivate plugin: ${error.message}`);
}

/**
 * Remove a plugin completely.
 */
export async function removePlugin(name: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("talos_plugins")
    .delete()
    .eq("name", name);

  if (error) throw new Error(`Failed to remove plugin: ${error.message}`);
}

function mapPluginFromDb(row: Record<string, unknown>): PluginRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    version: row.version as string,
    dockerImage: row.docker_image as string,
    configSchema: row.config_schema as Record<string, unknown> | undefined,
    healthEndpoint: row.health_endpoint as string | undefined,
    active: (row.active as boolean) ?? true,
    installedAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}
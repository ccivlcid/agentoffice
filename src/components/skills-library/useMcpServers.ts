import { useState, useEffect, useCallback } from "react";
import type { McpServer, McpPreset, McpRegistryEntry } from "../../api";
import * as api from "../../api";
import { inferMcpCategory } from "./McpServerList";

export function useMcpServers() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [presets, setPresets] = useState<McpPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string[] | null>(null);
  const [registry, setRegistry] = useState<McpRegistryEntry[]>([]);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registrySearch, setRegistrySearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api.getMcpServers(), api.getMcpPresets()]);
      setServers(s);
      setPresets(p);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (input: Parameters<typeof api.createMcpServer>[0]) => {
    setSubmitting(true);
    try {
      await api.createMcpServer(input);
      await load();
      setIsCreateOpen(false);
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async (id: string, patch: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await api.updateMcpServer(id, patch);
      await load();
      setEditingServer(null);
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      await api.deleteMcpServer(id);
      await load();
      setDeleteConfirmId(null);
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleMcpServer(id);
      await load();
    } catch (e) { setError(String(e)); }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncMcpServers();
      setSyncResult(result.synced);
      setTimeout(() => setSyncResult(null), 3000);
    } catch (e) { setError(String(e)); }
    finally { setSyncing(false); }
  };

  const loadRegistry = useCallback(async (search?: string) => {
    setRegistryLoading(true);
    try {
      const result = await api.getMcpRegistry(search);
      setRegistry(result.servers);
      setRegistryTotal(result.total);
    } catch (e) { setError(String(e)); }
    finally { setRegistryLoading(false); }
  }, []);

  const handleAddFromRegistry = async (entry: McpRegistryEntry, providers?: string[]) => {
    const packages = entry.packages || [];
    const npmPkg = packages.find((p) => p.registryType === "npm");
    if (!npmPkg) return;
    const envObj: Record<string, string> = {};
    for (const ev of (npmPkg.envVars || [])) {
      envObj[ev.name] = "";
    }
    await handleCreate({
      name: entry.title || entry.name,
      server_key: entry.name,
      package: npmPkg.identifier,
      command: "npx",
      args: ["-y", npmPkg.identifier],
      env: Object.keys(envObj).length > 0 ? envObj : undefined,
      description: entry.description,
      category: inferMcpCategory(entry),
      providers: providers ?? ["claude", "cursor"],
    });
  };

  const handleAddPreset = async (preset: McpPreset) => {
    await handleCreate({
      name: preset.name,
      server_key: preset.serverKey,
      package: preset.package,
      command: preset.command,
      args: preset.args,
      description: preset.description,
      category: preset.category,
      providers: ["claude", "cursor"],
    });
  };

  return {
    servers, presets, loading, editingServer, isCreateOpen, deleteConfirmId,
    submitting, error, syncing, syncResult,
    registry, registryTotal, registryLoading, registrySearch,
    setEditingServer, setIsCreateOpen, setDeleteConfirmId, setRegistrySearch,
    handleCreate, handleUpdate, handleDelete, handleToggle, handleSync, handleAddPreset,
    loadRegistry, handleAddFromRegistry,
    reload: load,
  };
}

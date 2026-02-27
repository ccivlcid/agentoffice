import { useState, useEffect, useCallback } from "react";
import type { ProjectRule, RulePreset } from "../../api";
import * as api from "../../api";

export function useRules() {
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [presets, setPresets] = useState<RulePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<ProjectRule | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([api.getRules(), api.getRulePresets()]);
      setRules(r);
      setPresets(p);
      setError(null);
      return r;
    } catch (e) {
      setError(String(e));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().then(async (r) => {
      if (r.length === 0) {
        setScanning(true);
        try {
          await api.scanProjectRules();
          await load();
        } catch {
          /* ignore auto-scan errors */
        } finally {
          setScanning(false);
        }
      }
    });
  }, [load]);

  const handleCreate = async (input: Parameters<typeof api.createRule>[0]) => {
    setSubmitting(true);
    try {
      await api.createRule(input);
      await load();
      setIsCreateOpen(false);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, patch: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await api.updateRule(id, patch);
      await load();
      setEditingRule(null);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      await api.deleteRule(id);
      await load();
      setDeleteConfirmId(null);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleRule(id);
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncRules();
      setSyncResult(result.synced);
      setTimeout(() => setSyncResult(null), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.scanProjectRules();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleAddPreset = async (preset: RulePreset) => {
    await handleCreate({
      name: preset.name,
      title: preset.title,
      description: preset.description,
      content: preset.content,
      category: preset.category,
      globs: preset.globs,
      always_apply: preset.alwaysApply,
      providers: ["claude", "cursor"],
    });
  };

  return {
    rules,
    presets,
    loading,
    editingRule,
    isCreateOpen,
    deleteConfirmId,
    submitting,
    error,
    syncing,
    syncResult,
    scanning,
    setEditingRule,
    setIsCreateOpen,
    setDeleteConfirmId,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    handleSync,
    handleScan,
    handleAddPreset,
    reload: load,
  };
}

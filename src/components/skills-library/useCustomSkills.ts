import { useState, useEffect, useCallback } from "react";
import {
  getCustomSkills,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  uploadCustomSkill,
  type CustomSkill,
} from "../../api";

export function useCustomSkills() {
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [editingSkill, setEditingSkill] = useState<CustomSkill | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomSkills = useCallback(() => {
    getCustomSkills()
      .then(setCustomSkills)
      .catch(() => setCustomSkills([]));
  }, []);

  useEffect(() => {
    loadCustomSkills();
  }, [loadCustomSkills]);

  const customSkillIds = new Set(customSkills.map((s) => s.id));

  const handleCreate = useCallback(
    async (input: {
      name: string;
      skill_id?: string;
      repo?: string;
      category?: string;
      description?: string;
      installs?: number;
    }) => {
      setSubmitting(true);
      setError(null);
      try {
        await createCustomSkill(input);
        loadCustomSkills();
        setIsCreateOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [loadCustomSkills],
  );

  const handleUpdate = useCallback(
    async (
      id: string,
      patch: {
        name?: string;
        skill_id?: string;
        repo?: string;
        category?: string | null;
        description?: string;
        installs?: number;
      },
    ) => {
      setSubmitting(true);
      setError(null);
      try {
        await updateCustomSkill(id, patch);
        loadCustomSkills();
        setEditingSkill(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [loadCustomSkills],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await deleteCustomSkill(id);
        setCustomSkills((prev) => prev.filter((s) => s.id !== id));
        setDeleteConfirmId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  // ---- Custom skill upload with .md file ----
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTrainingAnimation, setShowTrainingAnimation] = useState(false);
  const [trainingProvider, setTrainingProvider] = useState<string>("");
  const [trainingSkillName, setTrainingSkillName] = useState<string>("");

  const handleUpload = useCallback(
    async (data: { name: string; content: string; provider: string }) => {
      setSubmitting(true);
      setError(null);
      try {
        await uploadCustomSkill(data);
        loadCustomSkills();
        setShowUploadModal(false);
        setTrainingProvider(data.provider);
        setTrainingSkillName(data.name);
        setShowTrainingAnimation(true);
        setTimeout(() => setShowTrainingAnimation(false), 4000);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [loadCustomSkills],
  );

  return {
    customSkills,
    customSkillIds,
    editingSkill,
    setEditingSkill,
    isCreateOpen,
    setIsCreateOpen,
    deleteConfirmId,
    setDeleteConfirmId,
    submitting,
    error,
    handleCreate,
    handleUpdate,
    handleDelete,
    showUploadModal,
    setShowUploadModal,
    showTrainingAnimation,
    setShowTrainingAnimation,
    trainingProvider,
    trainingSkillName,
    handleUpload,
  };
}

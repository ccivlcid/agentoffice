import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  getSkills, getSkillDetail, getSkillLearningJob,
  getAvailableLearnedSkills, startSkillLearning, unlearnSkill,
  type LearnedSkillEntry, type SkillEntry, type SkillDetail,
  type SkillLearnJob, type SkillLearnProvider, type SkillHistoryProvider,
} from "../../api";
import type { Agent } from "../../types";
import {
  type CategorizedSkill, type UnlearnEffect,
  useI18n, formatInstalls,
  LEARN_PROVIDER_ORDER, LEARNED_PROVIDER_ORDER, pickRepresentativeForProvider,
} from "./skillsLibraryHelpers";
import { categorize } from "./skillCategorize";

export function useSkillsLibrary(agents: Agent[]) {
  const { t, localeTag } = useI18n();
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"rank" | "name" | "installs">("rank");
  const [copiedSkill, setCopiedSkill] = useState<string | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SkillDetail | "loading" | "error">>({});
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [learningSkill, setLearningSkill] = useState<CategorizedSkill | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<SkillLearnProvider[]>([]);
  const [learnJob, setLearnJob] = useState<SkillLearnJob | null>(null);
  const [learnSubmitting, setLearnSubmitting] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);
  const [unlearnError, setUnlearnError] = useState<string | null>(null);
  const [unlearningProviders, setUnlearningProviders] = useState<SkillLearnProvider[]>([]);
  const [unlearnEffects, setUnlearnEffects] = useState<Partial<Record<SkillLearnProvider, UnlearnEffect>>>({});
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [learnedRows, setLearnedRows] = useState<LearnedSkillEntry[]>([]);
  const unlearnEffectTimersRef = useRef<Partial<Record<SkillLearnProvider, number>>>({});

  const handleCardMouseEnter = useCallback((skill: CategorizedSkill) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      const detailId = skill.skillId || skill.name;
      const key = `${skill.repo}/${detailId}`;
      setHoveredSkill(key);
      if (!detailCache[key]) {
        setDetailCache((prev) => ({ ...prev, [key]: "loading" }));
        getSkillDetail(skill.repo, detailId)
          .then((d) => setDetailCache((prev) => ({ ...prev, [key]: d ?? "error" })))
          .catch(() => setDetailCache((prev) => ({ ...prev, [key]: "error" })));
      }
    }, 300);
  }, [detailCache]);

  const handleCardMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredSkill(null);
  }, []);

  useEffect(() => {
    getSkills().then(setSkills).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAvailableLearnedSkills({ limit: 500 })
      .then((rows) => { if (!cancelled) setLearnedRows(rows); })
      .catch(() => { if (!cancelled) setLearnedRows([]); });
    return () => { cancelled = true; };
  }, [historyRefreshToken]);

  const categorizedSkills = useMemo<CategorizedSkill[]>(
    () => skills.map((s) => ({ ...s, category: categorize(s.name, s.repo), installsDisplay: formatInstalls(s.installs, localeTag) })),
    [skills, localeTag]
  );

  const filtered = useMemo(() => {
    let result = selectedCategory !== "All" ? categorizedSkills.filter((s) => s.category === selectedCategory) : categorizedSkills;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.repo.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    if (sortBy === "name") return [...result].sort((a, b) => a.name.localeCompare(b.name, localeTag));
    if (sortBy === "installs") return [...result].sort((a, b) => b.installs - a.installs);
    return result;
  }, [categorizedSkills, search, selectedCategory, sortBy, localeTag]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: categorizedSkills.length };
    for (const s of categorizedSkills) counts[s.category] = (counts[s.category] || 0) + 1;
    return counts;
  }, [categorizedSkills]);

  const representatives = useMemo(
    () => LEARN_PROVIDER_ORDER.map((provider) => ({ provider, agent: pickRepresentativeForProvider(agents, provider) })),
    [agents]
  );
  const defaultSelectedProviders = useMemo(
    () => representatives.filter((r) => r.agent).map((r) => r.provider),
    [representatives]
  );
  const learnedRepresentatives = useMemo(() => {
    const out = new Map<SkillHistoryProvider, Agent | null>();
    for (const p of LEARNED_PROVIDER_ORDER) out.set(p, pickRepresentativeForProvider(agents, p));
    return out;
  }, [agents]);

  const learnedProvidersBySkill = useMemo(() => {
    const map = new Map<string, SkillHistoryProvider[]>();
    for (const row of learnedRows) {
      const key = `${row.repo}/${row.skill_id}`;
      if (!map.has(key)) map.set(key, []);
      const providers = map.get(key)!;
      if (!providers.includes(row.provider)) providers.push(row.provider);
    }
    for (const providers of map.values()) {
      providers.sort((a, b) => LEARNED_PROVIDER_ORDER.indexOf(a) - LEARNED_PROVIDER_ORDER.indexOf(b));
    }
    return map;
  }, [learnedRows]);

  const learningSkillDetailId = learningSkill ? learningSkill.skillId || learningSkill.name : "";
  const learningSkillKey = learningSkill ? `${learningSkill.repo}/${learningSkillDetailId}` : "";
  const modalLearnedProviders = useMemo(
    () => !learningSkillKey ? new Set<SkillHistoryProvider>() : new Set(learnedProvidersBySkill.get(learningSkillKey) ?? []),
    [learnedProvidersBySkill, learningSkillKey]
  );

  const learnInProgress = learnJob?.status === "queued" || learnJob?.status === "running";
  const preferKoreanName = localeTag.startsWith("ko");

  useEffect(() => () => {
    for (const id of Object.values(unlearnEffectTimersRef.current)) {
      if (typeof id === "number") window.clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    if (!learnJob || (learnJob.status !== "queued" && learnJob.status !== "running")) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      getSkillLearningJob(learnJob.id)
        .then((job) => { if (!cancelled) setLearnJob(job); })
        .catch((e: Error) => { if (!cancelled) setLearnError(e.message); });
    }, 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [learnJob]);

  useEffect(() => {
    if (learnJob && (learnJob.status === "succeeded" || learnJob.status === "failed")) {
      setHistoryRefreshToken((prev) => prev + 1);
    }
  }, [learnJob?.id, learnJob?.status]);

  const resetModalState = () => {
    setLearnJob(null); setLearnError(null); setUnlearnError(null);
    setUnlearningProviders([]); setUnlearnEffects({});
  };

  function openLearningModal(skill: CategorizedSkill) {
    const detailId = skill.skillId || skill.name;
    const learned = new Set(learnedProvidersBySkill.get(`${skill.repo}/${detailId}`) ?? []);
    setLearningSkill(skill);
    setSelectedProviders(defaultSelectedProviders.filter((p) => !learned.has(p)));
    resetModalState();
  }

  const closeLearningModal = useCallback(() => {
    if (learnInProgress) return;
    setLearningSkill(null); setSelectedProviders([]);
    resetModalState();
  }, [learnInProgress]);

  useEffect(() => {
    if (!learningSkill) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeLearningModal(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [learningSkill, closeLearningModal]);

  function toggleProvider(provider: SkillLearnProvider) {
    if (learnInProgress) return;
    setSelectedProviders((prev) => prev.includes(provider) ? prev.filter((p) => p !== provider) : [...prev, provider]);
  }

  async function handleStartLearning() {
    if (!learningSkill || selectedProviders.length === 0 || learnSubmitting || learnInProgress) return;
    setLearnSubmitting(true); setLearnError(null);
    try {
      const job = await startSkillLearning({ repo: learningSkill.repo, skillId: learningSkill.skillId || learningSkill.name, providers: selectedProviders });
      setLearnJob(job);
    } catch (e) { setLearnError(e instanceof Error ? e.message : String(e)); }
    finally { setLearnSubmitting(false); }
  }

  function triggerUnlearnEffect(provider: SkillLearnProvider) {
    const effect: UnlearnEffect = Math.random() < 0.5 ? "pot" : "hammer";
    setUnlearnEffects((prev) => ({ ...prev, [provider]: effect }));
    const cur = unlearnEffectTimersRef.current[provider];
    if (typeof cur === "number") window.clearTimeout(cur);
    unlearnEffectTimersRef.current[provider] = window.setTimeout(() => {
      setUnlearnEffects((prev) => { const n = { ...prev }; delete n[provider]; return n; });
      delete unlearnEffectTimersRef.current[provider];
    }, 1100);
  }

  async function handleUnlearnProvider(provider: SkillLearnProvider) {
    if (!learningSkill || learnInProgress || unlearningProviders.includes(provider)) return;
    const skillId = learningSkill.skillId || learningSkill.name;
    setUnlearnError(null);
    setUnlearningProviders((prev) => [...prev, provider]);
    try {
      const result = await unlearnSkill({ provider, repo: learningSkill.repo, skillId });
      if (result.removed > 0) {
        setLearnedRows((prev) => prev.filter((r) => !(r.provider === provider && r.repo === learningSkill.repo && r.skill_id === skillId)));
        triggerUnlearnEffect(provider);
      }
      setHistoryRefreshToken((prev) => prev + 1);
    } catch (e) { setUnlearnError(e instanceof Error ? e.message : String(e)); }
    finally { setUnlearningProviders((prev) => prev.filter((p) => p !== provider)); }
  }

  function handleCopy(skill: CategorizedSkill) {
    navigator.clipboard.writeText(`npx skills add ${skill.repo}`).then(() => {
      setCopiedSkill(skill.name);
      setTimeout(() => setCopiedSkill(null), 2000);
    });
  }

  function retryLoad() {
    setLoading(true); setError(null);
    getSkills().then(setSkills).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  return {
    skills, loading, error,
    search, setSearch, selectedCategory, setSelectedCategory, sortBy, setSortBy,
    copiedSkill, hoveredSkill, detailCache,
    learningSkill, selectedProviders, learnJob, learnSubmitting, learnError, unlearnError,
    unlearningProviders, unlearnEffects, historyRefreshToken, setHistoryRefreshToken, learnedRows,
    filtered, categoryCounts, categorizedSkills, representatives, defaultSelectedProviders,
    learnedRepresentatives, learnedProvidersBySkill, modalLearnedProviders,
    learnInProgress, preferKoreanName, t, localeTag,
    handleCardMouseEnter, handleCardMouseLeave, handleCopy,
    openLearningModal, closeLearningModal, toggleProvider, handleStartLearning, handleUnlearnProvider, retryLoad,
  };
}

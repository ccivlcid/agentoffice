import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import type { GatewayTarget } from "../api";
import type { TFunction } from "./SettingsPanelShared.tsx";

export interface UseSettingsPanelGatewayParams {
  tab: string;
  t: TFunction;
}

export interface UseSettingsPanelGatewayReturn {
  gwTargets: GatewayTarget[];
  gwLoading: boolean;
  loadGwTargets: () => void;
  gwSelected: string;
  setGwSelected: (v: string) => void;
  gwText: string;
  setGwText: (v: string) => void;
  gwSending: boolean;
  gwStatus: { ok: boolean; msg: string } | null;
  handleGwSend: () => Promise<void>;
}

export function useSettingsPanelGateway({
  tab,
  t,
}: UseSettingsPanelGatewayParams): UseSettingsPanelGatewayReturn {
  const [gwTargets, setGwTargets] = useState<GatewayTarget[]>([]);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwSelected, setGwSelected] = useState<string>(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("climpire.gateway.lastTarget") ?? ""
        : ""
  );
  const [gwText, setGwText] = useState("");
  const [gwSending, setGwSending] = useState(false);
  const [gwStatus, setGwStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadGwTargets = useCallback(() => {
    setGwLoading(true);
    setGwStatus(null);
    api
      .getGatewayTargets()
      .then((targets) => {
        setGwTargets(targets);
        if (targets.length > 0 && !targets.find((target) => target.sessionKey === gwSelected)) {
          const fallback = targets[0].sessionKey;
          setGwSelected(fallback);
          localStorage.setItem("climpire.gateway.lastTarget", fallback);
        }
      })
      .catch((err) => setGwStatus({ ok: false, msg: String(err) }))
      .finally(() => setGwLoading(false));
  }, [gwSelected]);

  useEffect(() => {
    if (tab === "gateway" && gwTargets.length === 0 && !gwLoading) loadGwTargets();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGwSend = useCallback(async () => {
    if (!gwSelected || !gwText.trim()) return;
    setGwSending(true);
    setGwStatus(null);
    try {
      const res = await api.sendGatewayMessage(gwSelected, gwText.trim());
      if (res.ok) {
        setGwStatus({
          ok: true,
          msg: t({ ko: "전송 완료!", en: "Sent!" }),
        });
        setGwText("");
      } else {
        setGwStatus({ ok: false, msg: res.error || "Send failed" });
      }
    } catch (err) {
      setGwStatus({ ok: false, msg: String(err) });
    } finally {
      setGwSending(false);
    }
  }, [gwSelected, gwText, t]);

  return {
    gwTargets,
    gwLoading,
    loadGwTargets,
    gwSelected,
    setGwSelected,
    gwText,
    setGwText,
    gwSending,
    gwStatus,
    handleGwSend,
  };
}

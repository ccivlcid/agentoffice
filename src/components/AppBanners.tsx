import type { UpdateBannerState } from "../hooks/useAppLabels";
import { UPDATE_BANNER_DISMISS_STORAGE_KEY } from "../appHelpers";

interface AppBannersProps extends UpdateBannerState {
  onDismissAutoUpdateNotice: () => void;
  onDismissUpdateBanner: (version: string) => void;
}

export function AppBanners(props: AppBannersProps) {
  const {
    autoUpdateNoticeVisible, autoUpdateNoticeTitle, autoUpdateNoticeHint, autoUpdateNoticeActionLabel,
    autoUpdateNoticeContainerClass, autoUpdateNoticeTextClass, autoUpdateNoticeHintClass, autoUpdateNoticeButtonClass,
    updateBannerVisible, effectiveUpdateStatus, updateReleaseUrl, updateTitle, updateHint,
    updateReleaseLabel, updateDismissLabel, updateTestModeHint,
    onDismissAutoUpdateNotice, onDismissUpdateBanner,
  } = props;

  return (
    <>
      {autoUpdateNoticeVisible && (
        <div className={autoUpdateNoticeContainerClass}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className={autoUpdateNoticeTextClass}>
              <div className="font-medium">{autoUpdateNoticeTitle}</div>
              <div className={autoUpdateNoticeHintClass}>{autoUpdateNoticeHint}</div>
            </div>
            <button type="button" onClick={onDismissAutoUpdateNotice} className={autoUpdateNoticeButtonClass}>
              {autoUpdateNoticeActionLabel}
            </button>
          </div>
        </div>
      )}
      {updateBannerVisible && effectiveUpdateStatus && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2.5 sm:px-4 lg:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-xs text-amber-100">
              <div className="font-medium">{updateTitle}</div>
              <div className="mt-0.5 text-[11px] text-amber-200/90">{updateHint}</div>
              {updateTestModeHint && <div className="mt-0.5 text-[11px] text-amber-300/90">{updateTestModeHint}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a href={updateReleaseUrl} target="_blank" rel="noreferrer"
                className="rounded-md border border-amber-300/40 bg-amber-200/10 px-2.5 py-1 text-[11px] text-amber-100 transition hover:bg-amber-200/20">
                {updateReleaseLabel}
              </a>
              <button type="button"
                onClick={() => {
                  const latest = effectiveUpdateStatus.latest_version ?? "";
                  onDismissUpdateBanner(latest);
                  if (typeof window !== "undefined") window.localStorage.setItem(UPDATE_BANNER_DISMISS_STORAGE_KEY, latest);
                }}
                className="rounded-md border border-slate-500/40 bg-slate-700/30 px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-slate-700/50">
                {updateDismissLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

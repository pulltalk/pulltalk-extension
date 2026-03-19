import type { CaptureMode } from "@/shared/messages";

const ICON_TAB =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>';
const ICON_WINDOW =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h12"/></svg>';
const ICON_MONITOR =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>';

export const MODAL_ID = "pulltalk-record-modal";

export function capCell(
  value: CaptureMode,
  icon: string,
  title: string,
  sub: string,
  checked: boolean,
): string {
  return `
    <label class="pt-cap" style="cursor:pointer;min-width:0">
      <input type="radio" name="pulltalk-mode" value="${value}" ${checked ? "checked" : ""} style="position:absolute;opacity:0;width:0;height:0" />
      <div class="pt-cap-box" style="border:2px solid #e2e8f0;border-radius:14px;padding:12px 8px;text-align:center;transition:border-color 0.15s,background 0.15s,color 0.15s;background:#fff">
        <div style="display:flex;justify-content:center;color:#64748b;margin-bottom:6px">${icon}</div>
        <div style="font-size:13px;font-weight:700;color:#334155;line-height:1.2">${title}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:4px;line-height:1.25">${sub}</div>
      </div>
    </label>`;
}

export function switchRow(
  id: string,
  title: string,
  subtitle: string,
  checked: boolean,
): string {
  return `
    <div class="pt-switch-row" style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid #f1f5f9">
      <div style="min-width:0;flex:1">
        <div style="font-size:14px;font-weight:700;color:#1e293b">${title}</div>
        <div style="font-size:12px;color:#64748b;margin-top:3px;line-height:1.35">${subtitle}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <span class="pt-lbl-off" data-sw="${id}" style="font-size:12px;font-weight:800;letter-spacing:0.04em;color:#cbd5e1;transition:color 0.15s">OFF</span>
        <label style="position:relative;display:inline-block;width:52px;height:30px;cursor:pointer;flex-shrink:0">
          <input type="checkbox" id="${id}" ${checked ? "checked" : ""} style="position:absolute;inset:0;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:2" />
          <span class="pt-tr" style="display:block;width:100%;height:100%;background:#cbd5e1;border-radius:999px;transition:background 0.2s;pointer-events:none"></span>
          <span class="pt-kb" style="position:absolute;top:3px;left:3px;width:24px;height:24px;background:#fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.12);transition:transform 0.2s;pointer-events:none"></span>
        </label>
        <span class="pt-lbl-on" data-sw="${id}" style="font-size:12px;font-weight:800;letter-spacing:0.04em;color:#cbd5e1;transition:color 0.15s">ON</span>
      </div>
    </div>`;
}

export function bindSwitch(
  card: HTMLElement,
  id: string,
  accent: string,
  onChange?: () => void,
): void {
  const input = card.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) return;
  const tr = input.closest("label")?.querySelector(".pt-tr") as HTMLElement;
  const kb = input.closest("label")?.querySelector(".pt-kb") as HTMLElement;
  const off = card.querySelector(`[data-sw="${id}"].pt-lbl-off`);
  const on = card.querySelector(`[data-sw="${id}"].pt-lbl-on`);
  const sync = (): void => {
    const v = input.checked;
    if (tr) tr.style.background = v ? accent : "#cbd5e1";
    if (kb) kb.style.transform = v ? "translateX(22px)" : "translateX(0)";
    if (off) (off as HTMLElement).style.color = v ? "#cbd5e1" : "#64748b";
    if (on) (on as HTMLElement).style.color = v ? accent : "#cbd5e1";
    onChange?.();
  };
  input.addEventListener("change", sync);
  sync();
}

export function selectedMode(card: HTMLElement): CaptureMode {
  const r = card.querySelector<HTMLInputElement>(
    'input[name="pulltalk-mode"]:checked',
  );
  return (r?.value ?? "tab") as CaptureMode;
}

export { ICON_TAB, ICON_WINDOW, ICON_MONITOR };

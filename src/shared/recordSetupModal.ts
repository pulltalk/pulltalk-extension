import type {
  DisplaySurfaceHint,
  RecordingType,
} from "@/shared/messages";
import {
  MODAL_ID,
  capCell,
  switchRow,
  bindSwitch,
  selectedMode,
  ICON_TAB,
  ICON_WINDOW,
  ICON_MONITOR,
} from "./setupModal/modalUi";
import { createTabPicker } from "./setupModal/tabPicker";
import { createCameraPreview } from "./setupModal/cameraPreview";

export type ModalResult =
  | { action: "start"; payload: Omit<import("@/shared/messages").StartRecordingPayload, "owner" | "repo" | "prId"> }
  | { action: "cancel" };

export function openRecordModal(prTabId: number | null): Promise<ModalResult> {
  return new Promise((resolve) => {
    const existing = document.getElementById(MODAL_ID);
    existing?.remove();

    const accent = "#15803d";
    const accentSoft = "#ecfdf5";

    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pulltalk-modal-title");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      boxSizing: "border-box",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "18px",
      padding: "0",
      width: "min(440px, 100%)",
      maxHeight: "92vh",
      overflowY: "auto",
      color: "#1e293b",
      boxShadow:
        "0 24px 48px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255,255,255,0.9) inset",
    });

    card.innerHTML = `
      <style>
        #${MODAL_ID} .pt-cap:has(input:checked) .pt-cap-box {
          border-color: ${accent} !important;
          background: ${accentSoft} !important;
          color: ${accent};
        }
        #${MODAL_ID} .pt-cap:has(input:checked) .pt-cap-box div:first-child { color: ${accent} !important; }
        #${MODAL_ID} .pt-cap:has(input:checked) .pt-cap-box div:nth-child(2) { color: #0f172a !important; }
        #${MODAL_ID} .pt-cap:hover .pt-cap-box { border-color: #cbd5e1; }
        #${MODAL_ID} select:focus, #${MODAL_ID} button:focus-visible, #${MODAL_ID} input:focus-visible + .pt-tr {
          outline: 2px solid ${accent}; outline-offset: 2px;
        }
      </style>
      <div style="padding:20px 22px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="display:flex;align-items:flex-start;gap:12px;min-width:0">
          <span style="display:flex;color:${accent};flex-shrink:0;margin-top:2px" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 7a16 16 0 0 1-16 16"/><path d="M23 7v6h-6"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </span>
          <div>
            <h2 id="pulltalk-modal-title" style="margin:0;font-size:19px;font-weight:800;letter-spacing:-0.03em;color:#0f172a">Record video comment</h2>
            <p style="margin:6px 0 0;font-size:13px;color:#64748b;line-height:1.45">Pick a source and start recording.</p>
          </div>
        </div>
        <button type="button" id="pulltalk-modal-close" aria-label="Close"
          style="flex-shrink:0;width:40px;height:40px;border:none;border-radius:12px;background:#f1f5f9;color:#64748b;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1">
          &times;
        </button>
      </div>

      <div style="padding:16px 22px 0">
        <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:0.1em;color:#94a3b8">CAPTURE SOURCE</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${capCell("tab", ICON_TAB, "Chrome tab", "Select tab", true)}
          ${capCell("window", ICON_WINDOW, "Window", "Share dialog", false)}
          ${capCell("monitor", ICON_MONITOR, "Entire screen", "Share dialog", false)}
        </div>
      </div>

      <div id="pulltalk-tab-pick-wrap" style="padding:0 22px 0;margin-top:4px;display:none">
        <p style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:0.1em;color:#94a3b8">WHICH TAB TO RECORD</p>
        <p style="margin:0 0 10px;font-size:12px;color:#64748b;line-height:1.5">Defaults to this tab.</p>
        <select id="pulltalk-capture-tab" aria-label="Tab to record"
          style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-size:14px;cursor:pointer;box-sizing:border-box">
        </select>
        <p id="pulltalk-tab-pick-empty" style="display:none;margin:10px 0 0;font-size:12px;color:#b45309;line-height:1.45">
          No available tabs found. Open a standard web page tab and try again.
        </p>
      </div>

      <div id="pulltalk-preview-wrap" style="display:none;margin:16px 22px 0;padding:16px;background:linear-gradient(145deg,#f8fafc 0%,#f1f5f9 100%);border-radius:14px;border:1px solid #e2e8f0">
        <p style="margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:0.1em;color:#94a3b8">LIVE CAMERA PREVIEW</p>
        <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">
          <div style="flex-shrink:0">
            <div style="width:112px;height:112px;border-radius:50%;overflow:hidden;background:#1e293b;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.12)">
              <video id="pulltalk-cam-preview" playsinline muted autoplay style="width:100%;height:100%;object-fit:cover;display:block"></video>
            </div>
            <p style="margin:8px 0 0;text-align:center;font-size:11px;font-weight:600;color:#64748b">You</p>
          </div>
          <div style="flex:1;min-width:160px">
            <div id="pulltalk-preview-vb-off" style="font-size:12px;color:#64748b;line-height:1.5">Turn on AI background to preview.</div>
            <div id="pulltalk-preview-vb-on" style="display:none">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#334155">Backdrop in recording</p>
              <div id="pulltalk-backdrop-swatch" style="height:72px;border-radius:12px;border:2px solid #e2e8f0;margin-bottom:8px"></div>
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.45">Selected color.</p>
            </div>
            <div id="pulltalk-preview-vb-blur" style="display:none">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#334155">Blur in recording</p>
              <div style="height:72px;border-radius:12px;border:2px solid #e2e8f0;margin-bottom:8px;background:linear-gradient(120deg,#dbeafe,#bfdbfe,#e2e8f0)"></div>
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.45">Background blur preview.</p>
            </div>
          </div>
        </div>
        <p id="pulltalk-preview-denied" style="display:none;margin:12px 0 0;font-size:12px;color:#b45309">Camera preview unavailable.</p>
      </div>

      <div style="padding:18px 22px">
        <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:0.1em;color:#94a3b8">RECORDING OPTIONS</p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff">
          ${switchRow("pulltalk-cam", "Camera", "Show camera overlay.", false)}
          ${switchRow("pulltalk-mic", "Microphone", "Record microphone audio.", true)}
          ${switchRow("pulltalk-ptt", "Push-to-talk", "Hold Space to talk.", false)}
          ${switchRow("pulltalk-vb", "AI virtual background", "Use color or blur.", false)}
          <div id="pulltalk-vb-controls" style="display:none;padding:12px 16px 16px;background:#fafafa;border-top:1px dashed #e2e8f0">
            <span style="font-size:12px;font-weight:600;color:#64748b">Background effect</span>
            <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
              <button type="button" class="pt-vbeffect" data-effect="color" style="padding:6px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-size:12px;font-weight:700;cursor:pointer">Color</button>
              <button type="button" class="pt-vbeffect" data-effect="blur" style="padding:6px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-size:12px;font-weight:700;cursor:pointer">Blur</button>
              <input type="hidden" id="pulltalk-vbeffect" value="color" />
            </div>
            <div id="pulltalk-vb-color-wrap" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px">
              <input type="color" id="pulltalk-vbcolor" value="#1a1a2e" title="Backdrop color"
                style="width:48px;height:40px;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;padding:3px;background:#fff" />
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${["#1a1a2e", "#0f172a", "#312e81", "#14532d", "#7c2d12", "#ffffff"]
                  .map(
                    (c) =>
                      `<button type="button" class="pt-preset" data-c="${c}" style="width:28px;height:28px;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer;background:${c};padding:0" aria-label="Color ${c}"></button>`,
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="padding:0 22px 20px">
        <label for="pulltalk-alarm" style="display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:8px">Auto-stop after</label>
        <select id="pulltalk-alarm" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-size:14px;cursor:pointer;box-sizing:border-box">
          <option value="">Off</option>
          <option value="5">5 minutes</option>
          <option value="10">10 minutes</option>
          <option value="15">15 minutes</option>
        </select>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 22px 22px;flex-wrap:wrap">
        <button type="button" id="pulltalk-cancel" style="padding:12px 10px;border:none;background:transparent;color:#64748b;cursor:pointer;font-size:14px;font-weight:700">
          Cancel
        </button>
        <button type="button" id="pulltalk-start" style="
          display:inline-flex;align-items:center;justify-content:center;gap:10px;
          padding:14px 22px;border-radius:14px;border:none;background:${accent};color:#fff;
          cursor:pointer;font-size:15px;font-weight:800;letter-spacing:-0.02em;
          box-shadow:0 6px 20px rgba(21,128,61,0.28);flex:1;min-width:180px;max-width:100%;
        ">
          <span style="width:12px;height:12px;border-radius:50%;background:#fff"></span>
          Start recording
        </button>
      </div>
    `;

    overlay.appendChild(card);

    const tabPickWrap = card.querySelector("#pulltalk-tab-pick-wrap") as HTMLElement;
    const tabSelect = card.querySelector("#pulltalk-capture-tab") as HTMLSelectElement;
    const tabPickEmpty = card.querySelector("#pulltalk-tab-pick-empty") as HTMLElement;
    const startBtn = card.querySelector("#pulltalk-start") as HTMLButtonElement;

    const tabPicker = createTabPicker(tabSelect, tabPickEmpty, tabPickWrap, startBtn, prTabId);
    void tabPicker.refreshTabs();

    const tabListPollMs = 2000;
    const tabListPoll = window.setInterval(() => { void tabPicker.refreshTabs(); }, tabListPollMs);
    const onWinFocus = (): void => { void tabPicker.refreshTabs(); };
    window.addEventListener("focus", onWinFocus);
    tabSelect.addEventListener("pointerdown", () => { void tabPicker.refreshTabs(); });

    const camCb = card.querySelector("#pulltalk-cam") as HTMLInputElement;
    const vbCb = card.querySelector("#pulltalk-vb") as HTMLInputElement;
    const colorInput = card.querySelector("#pulltalk-vbcolor") as HTMLInputElement;
    const bgEffectInput = card.querySelector("#pulltalk-vbeffect") as HTMLInputElement;
    const bgEffectButtons = Array.from(card.querySelectorAll<HTMLElement>(".pt-vbeffect"));
    const colorWrap = card.querySelector("#pulltalk-vb-color-wrap") as HTMLElement;
    const vbControls = card.querySelector("#pulltalk-vb-controls") as HTMLElement;

    const syncBgEffectControls = (): void => {
      const effect = bgEffectInput.value === "blur" ? "blur" : "color";
      vbControls.style.display = vbCb.checked ? "block" : "none";
      colorWrap.style.display = effect === "color" ? "flex" : "none";
      bgEffectButtons.forEach((btn) => {
        const selected = btn.dataset.effect === effect;
        btn.style.borderColor = selected ? accent : "#cbd5e1";
        btn.style.background = selected ? accentSoft : "#fff";
        btn.style.color = selected ? accent : "#334155";
      });
    };
    syncBgEffectControls();

    const camPreview = createCameraPreview(
      card.querySelector("#pulltalk-preview-wrap") as HTMLElement,
      card.querySelector("#pulltalk-cam-preview") as HTMLVideoElement,
      card.querySelector("#pulltalk-preview-vb-on") as HTMLElement,
      card.querySelector("#pulltalk-preview-vb-off") as HTMLElement,
      card.querySelector("#pulltalk-preview-vb-blur") as HTMLElement,
      card.querySelector("#pulltalk-backdrop-swatch") as HTMLElement,
      card.querySelector("#pulltalk-preview-denied") as HTMLElement,
      colorInput,
      bgEffectInput,
      camCb,
      vbCb,
    );

    bgEffectButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const effect = btn.dataset.effect === "blur" ? "blur" : "color";
        bgEffectInput.value = effect;
        syncBgEffectControls();
        camPreview.syncPreview();
      });
    });

    card.querySelectorAll(".pt-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = (btn as HTMLElement).dataset.c;
        if (c) {
          colorInput.value = c;
          colorInput.dispatchEvent(new Event("input"));
        }
      });
    });

    const micCb = card.querySelector<HTMLInputElement>("#pulltalk-mic")!;
    const pttCb = card.querySelector<HTMLInputElement>("#pulltalk-ptt")!;

    bindSwitch(card, "pulltalk-cam", accent, () => {
      if (!camCb.checked && vbCb.checked) {
        vbCb.checked = false;
        vbCb.dispatchEvent(new Event("change"));
        return;
      }
      camPreview.syncPreview();
    });
    bindSwitch(card, "pulltalk-mic", accent, () => {
      if (micCb.checked && pttCb.checked) {
        pttCb.checked = false;
        pttCb.dispatchEvent(new Event("change"));
      }
    });
    bindSwitch(card, "pulltalk-ptt", accent, () => {
      if (pttCb.checked && micCb.checked) {
        micCb.checked = false;
        micCb.dispatchEvent(new Event("change"));
      }
    });
    bindSwitch(card, "pulltalk-vb", accent, () => {
      if (vbCb.checked && !camCb.checked) {
        camCb.checked = true;
        camCb.dispatchEvent(new Event("change"));
      }
      syncBgEffectControls();
      camPreview.syncPreview();
    });

    card.querySelectorAll('input[name="pulltalk-mode"]').forEach((el) => {
      el.addEventListener("change", () => {
        camPreview.syncPreview();
        tabPicker.syncVisibility(selectedMode(card));
      });
    });

    camPreview.syncPreview();
    tabPicker.syncVisibility(selectedMode(card));

    const cleanup = (): void => {
      window.clearInterval(tabListPoll);
      window.removeEventListener("focus", onWinFocus);
      document.removeEventListener("keydown", onKey);
      camPreview.cleanup();
      overlay.remove();
    };

    const cancel = (): void => {
      cleanup();
      resolve({ action: "cancel" });
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
    };
    document.addEventListener("keydown", onKey, true);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cancel();
    });

    card.querySelector("#pulltalk-modal-close")?.addEventListener("click", cancel);
    card.querySelector("#pulltalk-cancel")?.addEventListener("click", cancel);

    card.querySelector("#pulltalk-start")?.addEventListener("click", () => {
      const captureMode = selectedMode(card);
      const recordingType: RecordingType = captureMode === "tab" ? "tab" : "screen";

      let displaySurfaceHint: DisplaySurfaceHint | null = null;
      if (captureMode === "window") displaySurfaceHint = "window";
      else if (captureMode === "monitor") displaySurfaceHint = "monitor";

      let captureTargetTabId: number | null = null;
      if (captureMode === "tab") {
        const v = tabSelect.value;
        const id = v ? parseInt(v, 10) : NaN;
        captureTargetTabId = Number.isFinite(id) ? id : null;
      }

      cleanup();
      resolve({
        action: "start",
        payload: {
          recordingType,
          captureMode,
          displaySurfaceHint,
          captureTargetTabId,
          cameraOn: camCb.checked,
          micOn: micCb.checked,
          pushToTalk: pttCb.checked,
          virtualBackground: vbCb.checked,
          virtualBgColor: colorInput.value ?? "#1a1a2e",
          virtualBgEffect: bgEffectInput.value === "blur" ? "blur" : "color",
          countdownSec: 0,
          alarmMinutes:
            (() => {
              const v = card.querySelector<HTMLSelectElement>("#pulltalk-alarm")?.value ?? "";
              return v === "" ? null : parseInt(v, 10) || null;
            })(),
        },
      });
    });

    document.body.appendChild(overlay);
  });
}

/** Message / port payloads between content, background, and recorder */

export type RecordingType = "tab" | "screen";

/** Matches Chrome’s share picker tabs (Chrome tab / Window / Entire screen). */
export type DisplaySurfaceHint = "browser" | "window" | "monitor";

export type CaptureMode = "tab" | "window" | "monitor";
export type VirtualBgEffect = "color" | "blur";

/** Written to session storage when opening the recorder setup flow from a PR tab */
export type RecorderSetupContext = {
  prTabId: number;
  owner: string;
  repo: string;
  prId: string;
};

export type StartRecordingPayload = {
  recordingType: RecordingType;
  captureMode: CaptureMode;
  /** Which Chrome picker tab to open first; null for tab (tabCapture). */
  displaySurfaceHint: DisplaySurfaceHint | null;
  /**
   * Tab to capture when `captureMode` is `tab` (chrome.tabCapture).
   * Null for window, monitor.
   */
  captureTargetTabId: number | null;
  cameraOn: boolean;
  micOn: boolean;
  pushToTalk: boolean;
  virtualBackground: boolean;
  virtualBgColor: string;
  virtualBgEffect: VirtualBgEffect;
  /** Deprecated — always 0 (no pre-roll countdown). */
  countdownSec: number;
  alarmMinutes: number | null;
  owner: string;
  repo: string;
  prId: string;
};

export type ExtensionMessage =
  | { type: "pulltalk-query-content-tab-id" }
  | {
      type: "pulltalk-list-injectable-tabs";
      /** PR tab to list first and select by default (this GitHub tab). */
      payload?: { preferredTabId?: number | null };
    }
  | { type: "start-recording"; payload: StartRecordingPayload }
  /** PR tab: open/focus recorder.html?setup=1 with session setup context */
  | {
      type: "open-recorder-setup";
      payload: { owner: string; repo: string; prId: string };
    }
  /**
   * Recorder extension tab: attach session to this tab (no tabs.create).
   * `prTabId` must match stored setup context.
   */
  | {
      type: "start-recording-in-tab";
      payload: StartRecordingPayload;
      prTabId: number;
    }
  /** Recorder tab: user cancelled setup — clear setup storage */
  | { type: "pulltalk-cancel-recorder-setup" }
  | { type: "stop-recording" }
  | { type: "recorder-ready" }
  | {
      type: "start-capture";
      payload: StartRecordingPayload;
    }
  | { type: "stop-capture" }
  /** Editor → background: Firebase upload succeeded (upload runs in editor — MV3 workers have no XHR). */
  | {
      type: "notify-pr-tab-recording-url";
      payload: {
        url: string;
        owner: string;
        repo: string;
        prId: string;
      };
    }
  | {
      type: "notify-pr-tab-recording-error";
      payload: {
        message: string;
        owner: string;
        repo: string;
        prId: string;
      };
    }
  | { type: "recording-error"; payload: { message: string } }
  | { type: "recording-url"; payload: { url: string } }
  /** PR tab: capture stopped; user must finish trim/upload in the editor extension tab */
  | { type: "recording-awaiting-editor" }
  | { type: "recording-edit-cancelled" }
  /** PR tab: MediaRecorder has started; start elapsed timer */
  | { type: "recording-started" }
  /** Internal: recorder → background to forward recording-started to PR tab */
  | { type: "pulltalk-recording-started-internal" }
  /** Recorder: register captured tab for scroll relay from PullTalk preview */
  | { type: "pulltalk-register-capture-tab"; payload: { tabId: number } }
  /** Recorder preview: forward wheel to scroll the captured tab */
  | { type: "pulltalk-relay-scroll"; payload: { dy: number } }
  /** Target-tab overlay: user clicked Stop */
  | { type: "pulltalk-stop-from-target-overlay" }
  /** Remove injected recording UI from captured tab */
  | { type: "pulltalk-overlay-teardown" }
  /** Recorder finished encoding — remove overlay on target tab */
  | { type: "pulltalk-teardown-target-overlay" };

export const RECORDER_PORT_NAME = "pulltalk-recorder";

export type RecorderPortMessage =
  | { type: "start-capture"; payload: StartRecordingPayload; tabCaptureStreamId?: string }
  | { type: "stop-capture" }
  | { type: "capture-error"; message: string };

const BAR_ID = "pulltalk-floating-bar";

export function showFloatingBar(onStop: () => void): {
  updateTimer: (seconds: number) => void;
  enterAwaitingEditorPhase: () => void;
  remove: () => void;
} {
  document.getElementById(BAR_ID)?.remove();

  const bar = document.createElement("div");
  bar.id = BAR_ID;
  Object.assign(bar.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483645",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "10px 18px",
    background: "#21262d",
    border: "1px solid #f85149",
    borderRadius: "999px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  });

  const dot = document.createElement("span");
  dot.style.cssText =
    "width:10px;height:10px;border-radius:50%;background:#f85149;animation:pulse 1.2s ease-in-out infinite";
  const style = document.createElement("style");
  style.textContent =
    "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}";
  bar.appendChild(style);
  bar.appendChild(dot);

  const timer = document.createElement("span");
  timer.style.cssText =
    "color:#e6edf3;font-size:15px;font-variant-numeric:tabular-nums;min-width:72px";
  timer.textContent = "Starting…";
  bar.appendChild(timer);

  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.textContent = "Stop";
  Object.assign(stopBtn.style, {
    padding: "8px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#da3633",
    color: "#fff",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  });
  stopBtn.addEventListener("click", onStop);
  bar.appendChild(stopBtn);

  document.body.appendChild(bar);

  return {
    updateTimer(seconds: number): void {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      timer.textContent = `${m}:${s.toString().padStart(2, "0")}`;
    },
    /** After stop: no longer “recording”; prompt user to use extension editor tab */
    enterAwaitingEditorPhase(): void {
      if (bar.querySelector(".pulltalk-editor-hint")) {
        return;
      }
      bar.style.borderColor = "#388bfd";
      dot.style.background = "#388bfd";
      dot.style.animation = "none";
      dot.style.opacity = "1";
      timer.textContent = "Editor";
      stopBtn.textContent = "Dismiss";
      stopBtn.style.background = "#21262d";
      stopBtn.style.border = "1px solid #30363d";
      const hint = document.createElement("span");
      hint.className = "pulltalk-editor-hint";
      hint.style.cssText =
        "color:#8b949e;font-size:12px;max-width:220px;line-height:1.35";
      hint.textContent = "Open the PullTalk browser tab → Upload or edit there.";
      bar.insertBefore(hint, stopBtn);
    },
    remove(): void {
      bar.remove();
    },
  };
}

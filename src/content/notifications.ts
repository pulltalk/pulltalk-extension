const TOAST_ID = "pulltalk-toast";

export function showToast(message: string, variant: "info" | "error" = "info"): void {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    Object.assign(el.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "2147483646",
      padding: "12px 16px",
      borderRadius: "8px",
      fontSize: "14px",
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      maxWidth: "320px",
      transition: "opacity 0.2s",
    });
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.style.background = variant === "error" ? "#da3633" : "#238636";
  el.style.color = "#fff";
  el.style.opacity = "1";

  window.setTimeout(() => {
    el!.style.opacity = "0";
    window.setTimeout(() => {
      el?.remove();
    }, 200);
  }, 4000);
}

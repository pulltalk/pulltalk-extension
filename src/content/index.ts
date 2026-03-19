import { injectRecordButton, initPullTalkUi } from "./recordButton";
import { findCommentTextareas } from "@/github/dom";

function injectAllButtons(): void {
  const textareas = findCommentTextareas();
  textareas.forEach((textarea) => {
    const parent = textarea.parentElement;
    if (parent instanceof HTMLElement) {
      injectRecordButton(parent);
    }
  });
}

function initialize(): void {
  if (!window.location.href.match(/\/pull\/\d+/)) {
    return;
  }

  initPullTalkUi();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectAllButtons);
  } else {
    injectAllButtons();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const textareas = node.querySelectorAll<HTMLTextAreaElement>(
            'textarea[name="comment[body]"]'
          );
          textareas.forEach((textarea) => {
            const parent = textarea.parentElement;
            if (parent instanceof HTMLElement) {
              injectRecordButton(parent);
            }
          });
        }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl && url.match(/\/pull\/\d+/)) {
      lastUrl = url;
      setTimeout(injectAllButtons, 500);
    }
  }).observe(document, { subtree: true, childList: true });
}

initialize();

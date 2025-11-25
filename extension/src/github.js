/**
 * Extracts the pull request ID from the current GitHub URL
 * @returns The PR ID as a string, or null if not on a PR page
 */
export function getCurrentPRId() {
    const match = window.location.href.match(/\/pull\/(\d+)/);
    return match ? match[1] : null;
}
/**
 * Extracts repository owner and name from the current GitHub URL
 * @returns Object with owner and repo, or null if not on a valid GitHub page
 */
export function getCurrentRepo() {
    const match = window.location.href.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
        return null;
    }
    return {
        owner: match[1],
        repo: match[2],
    };
}
/**
 * Inserts content into a GitHub comment textarea and triggers autosize
 * @param textarea - The textarea element to insert content into
 * @param content - The content to insert
 */
export function insertComment(textarea, content) {
    if (!textarea) {
        throw new Error("Textarea element is required");
    }
    const separator = textarea.value.trim() ? "\n\n" : "";
    textarea.value += `${separator}${content}\n`;
    // Trigger GitHub's autosize and input handlers
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

// Content script for GitHub integration
class GitHubIntegration {
  private isPRPage: boolean = false;
  private currentPR: GitHubPR | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.detectPRPage();
    this.observePageChanges();
  }

  private detectPRPage(): void {
    const path = window.location.pathname;
    const prRegex = /^\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const match = path.match(prRegex);

    if (match) {
      this.isPRPage = true;
      this.currentPR = {
        repoOwner: match[1],
        repoName: match[2],
        prNumber: parseInt(match[3]),
        prUrl: window.location.href
      };
      this.injectRecordButtons();
    }
  }

  private observePageChanges(): void {
    // Observe DOM changes for SPAs
    const observer = new MutationObserver(() => {
      if (this.isPRPage) {
        this.injectRecordButtons();
      } else {
        this.detectPRPage();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private injectRecordButtons(): void {
    // Find all comment boxes
    const commentBoxes = document.querySelectorAll([
      'form.js-inline-comment-form',
      'form.js-new-comment-form',
      'textarea[name="comment[body]"]'
    ].join(','));

    commentBoxes.forEach((commentBox: Element) => {
      if (commentBox.querySelector('.video-comment-btn')) return;

      const recordButton = this.createRecordButton();
      const form = commentBox.closest('form') || commentBox;
      
      if (form) {
        const buttonContainer = this.createButtonContainer();
        buttonContainer.appendChild(recordButton);
        
        if (form.querySelector('.form-actions')) {
          form.querySelector('.form-actions')?.prepend(buttonContainer);
        } else {
          form.appendChild(buttonContainer);
        }
      }
    });
  }

  private createButtonContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'video-comment-container mt-2';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';
    return container;
  }

  private createRecordButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'video-comment-btn btn btn-sm';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
        <path d="M0 6v4h2v-4h-2zm3 4.5c0 .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5c-.83 0-1.5.67-1.5 1.5v5z"/>
      </svg>
      Record Video
    `;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.startRecordingFlow();
    });

    return button;
  }

  private async startRecordingFlow(): Promise<void> {
    if (!this.currentPR) return;

    try {
      // Show recording UI
      this.showRecordingUI();
      
      // Start mock recording
      const recordingService = new MockRecordingService();
      const result = await recordingService.startRecording();
      
      // Upload video
      const uploadService = new MockUploadService();
      const videoUrl = await uploadService.uploadVideo(result.videoBlob);
      
      // Post comment
      const githubService = new MockGitHubService();
      await githubService.postVideoComment(this.currentPR, videoUrl);
      
      this.showSuccessMessage();
    } catch (error) {
      this.showErrorMessage(error instanceof Error ? error.message : 'Recording failed');
    }
  }

  private showRecordingUI(): void {
    // Implement recording UI overlay
    const overlay = document.createElement('div');
    overlay.className = 'video-recording-overlay';
    overlay.innerHTML = `
      <div class="video-recording-modal">
        <h3>Recording Video Comment</h3>
        <div class="recording-indicator">
          <div class="recording-dot"></div>
          <span>Recording...</span>
        </div>
        <button class="btn btn-danger stop-recording">Stop Recording</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  private showSuccessMessage(): void {
    this.showNotification('Video comment posted successfully!', 'success');
  }

  private showErrorMessage(message: string): void {
    this.showNotification(`Error: ${message}`, 'error');
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `video-comment-notification flash flash-${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '10000';

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GitHubIntegration());
} else {
  new GitHubIntegration();
}
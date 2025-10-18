// TypeScript interfaces
interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number | null;
  duration: number;
  error: string | null;
}

interface VideoComment {
  id: string;
  videoUrl: string;
  timestamp: Date;
  description: string;
  duration: number;
  status: 'uploading' | 'uploaded' | 'error';
}

interface GitHubPR {
  repoOwner: string;
  repoName: string;
  prNumber: number;
  prTitle: string;
  commentable: boolean;
}
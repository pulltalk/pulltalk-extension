/**
 * Mixes display/tab audio with microphone. Push-to-talk gates mic gain.
 */

export type AudioGraphOptions = {
  pushToTalk: boolean;
  /** Key held = mic on when pushToTalk */
  pttKey: string;
};

const DEFAULT_PTT = " ";

export function buildMixedAudioStream(
  displayStream: MediaStream,
  micStream: MediaStream | null,
  options: Partial<AudioGraphOptions> = {}
): MediaStream {
  const pushToTalk = options.pushToTalk ?? false;
  const pttKey = options.pttKey ?? DEFAULT_PTT;

  const displayAudio = displayStream.getAudioTracks();
  const hasMic = micStream && micStream.getAudioTracks().length > 0;

  if (!hasMic && displayAudio.length === 0) {
    return new MediaStream();
  }

  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  const micGain = ctx.createGain();
  micGain.gain.value = pushToTalk ? 0 : 1;

  if (displayAudio.length > 0) {
    const src = ctx.createMediaStreamSource(
      new MediaStream(displayAudio)
    );
    src.connect(dest);
  }

  if (hasMic && micStream) {
    const micSrc = ctx.createMediaStreamSource(micStream);
    micSrc.connect(micGain);
    micGain.connect(dest);
  }

  const down = (e: KeyboardEvent): void => {
    if (e.key === pttKey || e.code === "Space") {
      if (pushToTalk) {
        micGain.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
      }
    }
  };
  const up = (e: KeyboardEvent): void => {
    if (e.key === pttKey || e.code === "Space") {
      if (pushToTalk) {
        micGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    }
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);

  const stream = dest.stream;
  (stream as MediaStream & { _pulltalkCtx?: AudioContext })._pulltalkCtx =
    ctx;
  (stream as MediaStream & { _pulltalkCleanup?: () => void })._pulltalkCleanup =
    (): void => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      void ctx.close();
    };

  return stream;
}

export function cleanupAudioStream(stream: MediaStream): void {
  const ext = stream as MediaStream & { _pulltalkCleanup?: () => void };
  ext._pulltalkCleanup?.();
}

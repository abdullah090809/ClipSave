import { requireNativeModule } from 'expo';

/**
 * Joins a video-only MP4 (H.264) and an audio-only M4A (AAC) into one MP4 without
 * re-encoding. Implemented natively with Android's MediaMuxer (modules/clipsave-muxer).
 * All three arguments are file:// URIs.
 */
interface ClipSaveMuxerNative {
  mux(videoUri: string, audioUri: string, outputUri: string): Promise<void>;
}

let cached: ClipSaveMuxerNative | undefined;

function getNative(): ClipSaveMuxerNative {
  if (!cached) {
    try {
      cached = requireNativeModule<ClipSaveMuxerNative>('ClipSaveMuxer');
    } catch {
      throw new Error(
        'HD video joining is not available in this build. Install the latest APK (it does not work in Expo Go).'
      );
    }
  }
  return cached;
}

export async function muxVideoAndAudio(videoUri: string, audioUri: string, outputUri: string): Promise<void> {
  await getNative().mux(videoUri, audioUri, outputUri);
}

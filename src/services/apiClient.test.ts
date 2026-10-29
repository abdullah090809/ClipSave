import { resolveTikTokUrl, extractSnapDeploySubdomain } from './apiClient';
import { saveSettings } from '../storage/settingsStore';

describe('apiClient', () => {
  beforeEach(async () => {
    await saveSettings({ useMockResolver: true });
  });

  test('extractSnapDeploySubdomain accurately extracts container identifier', () => {
    expect(extractSnapDeploySubdomain('https://clipsave-96518.containers.snapdeploy.app')).toBe('clipsave-96518');
    expect(extractSnapDeploySubdomain('http://my-service.containers.snapdeploy.app/')).toBe('my-service');
    expect(extractSnapDeploySubdomain('http://localhost:8000')).toBeNull();
  });

  test('resolves valid public TikTok URL in mock resolver mode', async () => {
    const media = await resolveTikTokUrl('https://www.tiktok.com/@user/video/734891238910');
    expect(media).toBeDefined();
    expect(media.id).toBeTruthy();
    expect(media.mediaUrl).toMatch(/^https?:\/\//);
    expect(media.title).toContain('ClipSave Test Media');
    expect(media.format).toBe('mp4');
    expect(media.isCleanSourceVerified).toBe(true);
  });

  test('rejects private video link with appropriate user-facing explanation', async () => {
    await expect(
      resolveTikTokUrl('https://www.tiktok.com/@user/video/private_123')
    ).rejects.toThrow('This video is private or restricted');
  });

  test('rejects deleted or missing video link', async () => {
    await expect(
      resolveTikTokUrl('https://www.tiktok.com/@user/video/deleted_404')
    ).rejects.toThrow('unavailable or has been removed');
  });

  test('resolves YouTube video with multiple quality options and audio', async () => {
    const media = await resolveTikTokUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    expect(media).toBeDefined();
    expect(media.platform).toBe('youtube');
    expect(media.availableFormats).toBeDefined();
    expect(media.availableFormats!.length).toBeGreaterThanOrEqual(3);

    const qualityIds = media.availableFormats!.map((f) => f.id);
    expect(qualityIds).toContain('1080p');
    expect(qualityIds).toContain('720p');
    expect(qualityIds).toContain('audio');

    const audioFmt = media.availableFormats!.find((f) => f.id === 'audio');
    expect(audioFmt).toBeDefined();
    expect(audioFmt!.isVideo).toBe(false);
    expect(audioFmt!.extension).toBe('mp3');
  });

  test('resolves YouTube Shorts with correct short format indicator', async () => {
    const media = await resolveTikTokUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(media).toBeDefined();
    expect(media.platform).toBe('youtube');
    expect(media.title).toContain('Short');
    expect(media.availableFormats).toBeDefined();
  });

  test('resolves Instagram Reel with correct platform and audio options', async () => {
    const media = await resolveTikTokUrl('https://www.instagram.com/reel/C8q8q0_PzZg/');
    expect(media).toBeDefined();
    expect(media.platform).toBe('instagram');
    expect(media.title).toContain('Instagram Reel');
    expect(media.availableFormats).toBeDefined();
    expect(media.availableFormats!.length).toBeGreaterThanOrEqual(2);
  });

  test('resolves Facebook Reel with correct platform and audio options', async () => {
    const media = await resolveTikTokUrl('https://www.facebook.com/reel/1234567890');
    expect(media).toBeDefined();
    expect(media.platform).toBe('facebook');
    expect(media.title).toContain('Facebook Reel');
    expect(media.availableFormats).toBeDefined();
    expect(media.availableFormats!.length).toBeGreaterThanOrEqual(2);
  });
});

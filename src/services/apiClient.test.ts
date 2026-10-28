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
});

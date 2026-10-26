import { ResolvedMedia } from '../types';

export const MOCK_RESOLVED_MEDIA: ResolvedMedia = {
  id: 'mock_734891238910',
  sourceUrl: 'https://www.tiktok.com/@creator/video/734891238910',
  title: 'Sample Creative Public Video (Mock Development Data)',
  author: 'CreativeCreator',
  authorUsername: '@creativecreator',
  durationSeconds: 24,
  thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
  // Small sample open-source public MP4 video for local development testing
  mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  estimatedSizeBytes: 15420390,
  format: 'mp4',
  expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  isCleanSourceVerified: true,
};

export async function resolveMockTikTokUrl(url: string): Promise<ResolvedMedia> {
  // Simulate brief local delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (url.includes('private') || url.includes('blocked')) {
    throw new Error('This video is private or restricted by the creator. ClipSave cannot access private content.');
  }

  if (url.includes('deleted') || url.includes('404')) {
    throw new Error('The requested video is unavailable or has been removed from TikTok.');
  }

  return {
    ...MOCK_RESOLVED_MEDIA,
    sourceUrl: url,
    title: `ClipSave Test Media - ${new Date().toLocaleTimeString()} (Dev Mock)`,
  };
}

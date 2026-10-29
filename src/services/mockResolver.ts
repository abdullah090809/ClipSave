import { ResolvedMedia, MediaFormatOption } from '../types';
import { detectPlatform } from '../utils/urlValidator';

export const MOCK_RESOLVED_MEDIA: ResolvedMedia = {
  id: 'mock_734891238910',
  sourceUrl: 'https://www.tiktok.com/@creator/video/734891238910',
  platform: 'tiktok',
  title: 'Sample Creative Public Video (Mock Development Data)',
  author: 'CreativeCreator',
  authorUsername: '@creativecreator',
  durationSeconds: 24,
  thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
  mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  estimatedSizeBytes: 15420390,
  format: 'mp4',
  quality: '1080p',
  availableFormats: [
    {
      id: '1080p',
      label: '1080p HD (No Watermark)',
      quality: '1080p',
      extension: 'mp4',
      isVideo: true,
      mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      estimatedSizeBytes: 15420390,
      note: 'Watermark Free',
    },
    {
      id: 'audio',
      label: 'Audio Only (MP3)',
      quality: 'audio',
      extension: 'mp3',
      isVideo: false,
      mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      estimatedSizeBytes: 2450000,
      note: 'Original Audio',
    },
  ],
  expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  isCleanSourceVerified: true,
};

export async function resolveMockMediaUrl(url: string): Promise<ResolvedMedia> {
  // Simulate brief local delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (url.includes('private') || url.includes('blocked')) {
    throw new Error('This video is private or restricted by the creator. ClipSave cannot access private content.');
  }

  if (url.includes('deleted') || url.includes('404')) {
    throw new Error('The requested video is unavailable or has been removed.');
  }

  const { platform, isShort } = detectPlatform(url);

  if (platform === 'youtube') {
    const formats: MediaFormatOption[] = [
      {
        id: '1080p',
        label: '1080p Full HD',
        quality: '1080p',
        extension: 'mp4',
        isVideo: true,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        estimatedSizeBytes: isShort ? 14200000 : 45200000,
        note: 'Full HD',
      },
      {
        id: '720p',
        label: '720p HD',
        quality: '720p',
        extension: 'mp4',
        isVideo: true,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        estimatedSizeBytes: isShort ? 8100000 : 22100000,
        note: 'HD',
      },
      {
        id: '360p',
        label: '360p SD',
        quality: '360p',
        extension: 'mp4',
        isVideo: true,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        estimatedSizeBytes: isShort ? 3200000 : 8400000,
        note: 'Data Saver',
      },
      {
        id: 'audio',
        label: 'Audio Only (MP3)',
        quality: 'audio',
        extension: 'mp3',
        isVideo: false,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        estimatedSizeBytes: isShort ? 1200000 : 3800000,
        note: 'High Quality MP3',
      },
    ];

    return {
      id: `mock_yt_${Date.now()}`,
      sourceUrl: url,
      platform: 'youtube',
      title: isShort
        ? `Amazing YouTube Short #viral - ${new Date().toLocaleTimeString()} (Dev Mock)`
        : `YouTube Video Feature - ${new Date().toLocaleTimeString()} (Dev Mock)`,
      author: 'YouTubeCreator',
      authorUsername: '@youtubecreator',
      durationSeconds: isShort ? 45 : 180,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
      mediaUrl: formats[0]!.mediaUrl,
      directMediaUrl: formats[0]!.mediaUrl,
      estimatedSizeBytes: formats[0]!.estimatedSizeBytes,
      format: 'mp4',
      quality: '1080p',
      availableFormats: formats,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      isCleanSourceVerified: true,
    };
  }

  if (platform === 'instagram') {
    const formats: MediaFormatOption[] = [
      {
        id: '1080p',
        label: 'Instagram HD Video',
        quality: '1080p',
        extension: 'mp4',
        isVideo: true,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        estimatedSizeBytes: 14500000,
        note: 'HD Reel',
      },
      {
        id: 'audio',
        label: 'Audio Only (MP3)',
        quality: 'audio',
        extension: 'mp3',
        isVideo: false,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        estimatedSizeBytes: 1800000,
        note: 'Audio Track',
      },
    ];

    return {
      id: `mock_ig_${Date.now()}`,
      sourceUrl: url,
      platform: 'instagram',
      title: isShort
        ? `Trending Instagram Reel - ${new Date().toLocaleTimeString()} (Dev Mock)`
        : `Instagram Video Post - ${new Date().toLocaleTimeString()} (Dev Mock)`,
      author: 'InstagramCreator',
      authorUsername: '@instagramcreator',
      durationSeconds: 28,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
      mediaUrl: formats[0]!.mediaUrl,
      directMediaUrl: formats[0]!.mediaUrl,
      estimatedSizeBytes: formats[0]!.estimatedSizeBytes,
      format: 'mp4',
      quality: '1080p',
      availableFormats: formats,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      isCleanSourceVerified: true,
    };
  }

  if (platform === 'facebook') {
    const formats: MediaFormatOption[] = [
      {
        id: '1080p',
        label: 'Facebook HD Video',
        quality: '1080p',
        extension: 'mp4',
        isVideo: true,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        estimatedSizeBytes: 19200000,
        note: 'HD Video',
      },
      {
        id: 'audio',
        label: 'Audio Only (MP3)',
        quality: 'audio',
        extension: 'mp3',
        isVideo: false,
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        estimatedSizeBytes: 2200000,
        note: 'Audio Track',
      },
    ];

    return {
      id: `mock_fb_${Date.now()}`,
      sourceUrl: url,
      platform: 'facebook',
      title: isShort
        ? `Popular Facebook Reel - ${new Date().toLocaleTimeString()} (Dev Mock)`
        : `Facebook Video - ${new Date().toLocaleTimeString()} (Dev Mock)`,
      author: 'FacebookCreator',
      authorUsername: '@facebookcreator',
      durationSeconds: 45,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
      mediaUrl: formats[0]!.mediaUrl,
      directMediaUrl: formats[0]!.mediaUrl,
      estimatedSizeBytes: formats[0]!.estimatedSizeBytes,
      format: 'mp4',
      quality: '1080p',
      availableFormats: formats,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      isCleanSourceVerified: true,
    };
  }

  return {
    ...MOCK_RESOLVED_MEDIA,
    sourceUrl: url,
    title: `ClipSave Test Media - ${new Date().toLocaleTimeString()} (Dev Mock)`,
  };
}

export const resolveMockTikTokUrl = resolveMockMediaUrl;

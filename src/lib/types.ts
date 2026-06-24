export interface Website {
  id: string;
  name: string;
  url: string;
  domain: string;
  customIcon?: string;
  orderIndex?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  websites: Website[];
  orderIndex?: number;
}

export interface UserSettings {
  wallpaperEnabled: boolean;
  selectedSearchEngine: string;
  lastWallpaperKeyword: string;
  customWallpaperKeywords: string;
}

export interface UnsplashState {
  accessToken: string;
  username: string;
  connectedAt?: string;
  foyerCollectionId: string | null;
}

export interface SearchEngine {
  name: string;
  icon: string;
  color: string;
  placeholder: string;
  url: string;
}

interface UnsplashPhoto {
  id: string;
  photoUrl: string;
  photographerName: string;
  photographerUrl: string;
}

export interface CachedWallpaper extends UnsplashPhoto {
  previewUrl: string;
  highResUrl: string;
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallpaperPicker, type WallpaperPhoto, type UnsplashCollection } from "@/hooks/useWallpaperPicker";
import { showToast } from "@/lib/toast";
import type { CachedWallpaper } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  startOAuth: () => void;
  setWallpaper: (photo: CachedWallpaper) => void;
  markAsLiked: (photoId: string) => void;
}

type Tab = "foyer" | "browse";

export default function WallpaperPicker({ open, onClose, connected, startOAuth, setWallpaper, markAsLiked }: Props) {
  const [tab, setTab] = useState<Tab>("foyer");
  const [searchInput, setSearchInput] = useState("");
  const picker = useWallpaperPicker();

  // Reset state + load data each time the modal opens
  useEffect(() => {
    if (!open) return;
    setTab("foyer");
    setSearchInput("");
    picker.closeCollection();
    picker.ensureLoaded();
    picker.refreshConnection();
    picker.loadFavorites();
    picker.loadFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePick = useCallback((photo: WallpaperPhoto, fromFoyer: boolean) => {
    // Photos from the Foyer collection are liked by definition — mirror them into
    // the local liked list so the existing refreshHeart keeps the heart red.
    if (fromFoyer) markAsLiked(photo.id);
    const photoData: CachedWallpaper = {
      id: photo.id,
      photoUrl: photo.photoUrl,
      photographerName: photo.photographerName,
      photographerUrl: photo.photographerUrl,
      previewUrl: photo.previewUrl,
      highResUrl: photo.highResUrl,
    };
    setWallpaper(photoData);
    showToast("Wallpaper set ✨");
    onClose();
  }, [markAsLiked, setWallpaper, onClose]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    picker.closeCollection();
    picker.searchCollections(searchInput);
  };

  const openCollection = (col: UnsplashCollection) => {
    setSearchInput("");
    picker.openCollection(col);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "foyer") picker.loadFavorites();
    if (t === "browse") {
      picker.closeCollection();
      picker.loadFeatured();
    }
  };

  if (!open) return null;

  const photoGrid = (photos: WallpaperPhoto[], loading: boolean, error: string | null, onRetry: () => void, empty: React.ReactNode, fromFoyer: boolean) => {
    if (loading) {
      return (
        <div className="wallpaper-grid">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="wallpaper-photo-card wallpaper-photo-skeleton"></div>)}
        </div>
      );
    }
    if (error) {
      return (
        <div className="widget-error">
          <span className="widget-error-icon">🖼️</span>
          <span className="widget-error-msg">{error}</span>
          <button className="btn-retry" onClick={onRetry}>Retry</button>
        </div>
      );
    }
    if (photos.length === 0) {
      return <div className="wallpaper-empty">{empty}</div>;
    }
    return (
      <div className="wallpaper-grid">
        {photos.map((photo) => (
          <div key={photo.id} className="wallpaper-photo-card">
            <img src={photo.previewUrl} alt={photo.photographerName} loading="lazy" />
            <div className="wallpaper-photo-overlay">
              <button className="btn-set-wallpaper" onClick={() => handlePick(photo, fromFoyer)}>
                <i className="fa-solid fa-image"></i> Set as wallpaper
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const collectionGrid = (collections: UnsplashCollection[], loading: boolean, error: string | null, empty: React.ReactNode) => {
    if (loading) {
      return (
        <div className="collection-grid">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="collection-card collection-card-skeleton"></div>)}
        </div>
      );
    }
    if (error) {
      return (
        <div className="widget-error">
          <span className="widget-error-icon">🗂️</span>
          <span className="widget-error-msg">{error}</span>
          <button className="btn-retry" onClick={() => picker.loadFeatured()}>Retry</button>
        </div>
      );
    }
    if (collections.length === 0) {
      return <div className="wallpaper-empty">{empty}</div>;
    }
    return (
      <div className="collection-grid">
        {collections.map((col) => (
          <div key={col.id} className="collection-card" onClick={() => openCollection(col)}>
            <img src={col.coverUrl} alt={col.title} loading="lazy" />
            <div className="collection-card-info">
              <span className="collection-card-title" title={col.title}>{col.title}</span>
              <span className="collection-card-count">{col.totalPhotos} photos</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="modal wallpaper-picker-modal">
      <div className="modal-content wallpaper-picker-content">
        <div className="modal-header">
          <h2><i className="fa-solid fa-images" style={{ marginRight: 10 }}></i>Wallpaper Picker</h2>
          <button className="close-btn" aria-label="Close wallpaper picker" onClick={onClose}>&times;</button>
        </div>

        <div className="wallpaper-tabs">
          <button className={`wallpaper-tab${tab === "foyer" ? " active" : ""}`} onClick={() => switchTab("foyer")}>
            <i className="fa-solid fa-heart" style={{ marginRight: 6 }}></i>My Favorites
          </button>
          <button className={`wallpaper-tab${tab === "browse" ? " active" : ""}`} onClick={() => switchTab("browse")}>
            <i className="fa-solid fa-compass" style={{ marginRight: 6 }}></i>Explore
          </button>
        </div>

        <div className="modal-form wallpaper-picker-body">
          {tab === "foyer" ? (
            !connected ? (
              <div className="wallpaper-empty">
                <span className="wallpaper-empty-icon">🔗</span>
                <p className="wallpaper-empty-title">Connect Unsplash to see your favorites</p>
                <p className="wallpaper-empty-desc">Link your Unsplash account, then tap the ❤️ on any wallpaper to save it to your Foyer collection.</p>
                <button className="btn-primary" onClick={startOAuth}><i className="fa-solid fa-link" style={{ marginRight: 6 }}></i>Connect Unsplash</button>
              </div>
            ) : (
              photoGrid(
                picker.favorites,
                picker.favoritesLoading,
                picker.favoritesError,
                picker.loadFavorites,
                <>
                  <span className="wallpaper-empty-icon">💛</span>
                  <p className="wallpaper-empty-title">No favorites yet</p>
                  <p className="wallpaper-empty-desc">Tap the ❤️ on a wallpaper to save it to your Foyer collection — it will show up here.</p>
                </>,
                true
              )
            )
          ) : (
            <>
              <form className="wallpaper-search" onSubmit={handleSearch}>
                <i className="fa-solid fa-magnifying-glass wallpaper-search-icon"></i>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search collections… e.g. nature, minimal, neon"
                  className="wallpaper-search-input"
                />
                <button type="submit" className="btn-primary wallpaper-search-btn">Search</button>
              </form>

              {picker.activeCollection ? (
                <>
                  <div className="collection-header">
                    <button className="btn-secondary collection-back-btn" onClick={() => picker.closeCollection()}>
                      <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }}></i>Back
                    </button>
                    <span className="collection-header-title" title={picker.activeCollection.title}>{picker.activeCollection.title}</span>
                    <span className="collection-header-count">{picker.activeCollection.totalPhotos} photos</span>
                  </div>
                  {photoGrid(picker.collectionPhotos, picker.browseLoading, picker.browseError, () => picker.openCollection(picker.activeCollection!), <>No photos in this collection.</>, false)}
                </>
              ) : picker.searchQuery ? (
                <>
                  <div className="wallpaper-section-title">Results for “{picker.searchQuery}”</div>
                  {collectionGrid(picker.searchResults, picker.browseLoading, picker.browseError, <>No collections found. Try a different search.</>)}
                </>
              ) : (
                <>
                  <div className="wallpaper-section-title">Featured Collections</div>
                  {collectionGrid(picker.featured, picker.browseLoading, picker.browseError, <>No collections available.</>)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRoast } from '@/hooks/useRoast';
import { useRouter, usePathname } from 'next/navigation';
import type { Product } from '@/types';

interface FavoritesContextValue {
  favoriteIds: string[];
  favoriteProducts: Product[];
  loading: boolean;
  isFavorited: (productId: string) => boolean;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string, product?: Product) => Promise<boolean>;
  addFavorite: (productId: string, product?: Product) => Promise<boolean>;
  removeFavorite: (productId: string) => Promise<boolean>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useRoast();
  const router = useRouter();
  const pathname = usePathname();

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Keep a stable ref of favoriteIds for rollbacks and synchronous checks
  const favoriteIdsRef = useRef<string[]>([]);
  const favoriteProductsRef = useRef<Product[]>([]);

  useEffect(() => {
    favoriteIdsRef.current = favoriteIds;
  }, [favoriteIds]);

  useEffect(() => {
    favoriteProductsRef.current = favoriteProducts;
  }, [favoriteProducts]);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds([]);
      setFavoriteProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/favorites', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const ids: string[] = data.favoriteIds || [];
        const prods: Product[] = data.products || [];
        setFavoriteIds(ids);
        setFavoriteProducts(prods);
      } else {
        setFavoriteIds([]);
        setFavoriteProducts([]);
      }
    } catch (err) {
      console.warn('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Handle pending favorite after login
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      const pending = sessionStorage.getItem('gerkink_pending_favorite');
      if (pending) {
        sessionStorage.removeItem('gerkink_pending_favorite');
        // Add pending favorite in background
        fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: pending }),
        })
          .then((res) => {
            if (res.ok) {
              toast('Saved to your wishlist!', 'success');
              fetchFavorites();
            }
          })
          .catch(() => {});
      }
    }
  }, [user, fetchFavorites, toast]);

  // Load favorites when user changes
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorited = useCallback(
    (productId: string): boolean => {
      if (!productId) return false;
      return favoriteIds.includes(productId);
    },
    [favoriteIds]
  );

  const addFavorite = useCallback(
    async (productId: string, product?: Product): Promise<boolean> => {
      if (!productId) return false;

      // Handle unauthenticated user
      if (!user) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('gerkink_pending_favorite', productId);
        }
        toast('Sign in to save items to your wishlist.', 'roast');
        const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
        router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
        return false;
      }

      // Already favorited check
      if (favoriteIdsRef.current.includes(productId)) {
        return true;
      }

      // Optimistic update
      const prevIds = [...favoriteIdsRef.current];
      const prevProducts = [...favoriteProductsRef.current];

      setFavoriteIds((prev) => [...prev, productId]);
      if (product) {
        setFavoriteProducts((prev) => [...prev.filter((p) => p.id !== productId), product]);
      }

      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });

        if (!res.ok) {
          throw new Error('Failed to save favorite');
        }
        return true;
      } catch (err) {
        // Rollback on failure
        setFavoriteIds(prevIds);
        setFavoriteProducts(prevProducts);
        toast('Could not save favorite. Please try again.', 'error');
        return false;
      }
    },
    [user, router, pathname, toast]
  );

  const removeFavorite = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!productId) return false;

      if (!user) {
        return false;
      }

      // Not favorited check
      if (!favoriteIdsRef.current.includes(productId)) {
        return true;
      }

      // Optimistic update
      const prevIds = [...favoriteIdsRef.current];
      const prevProducts = [...favoriteProductsRef.current];

      setFavoriteIds((prev) => prev.filter((id) => id !== productId));
      setFavoriteProducts((prev) => prev.filter((p) => p.id !== productId));

      try {
        const res = await fetch(`/api/favorites?productId=${encodeURIComponent(productId)}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          throw new Error('Failed to remove favorite');
        }
        return true;
      } catch (err) {
        // Rollback on failure
        setFavoriteIds(prevIds);
        setFavoriteProducts(prevProducts);
        toast('Could not remove favorite. Please try again.', 'error');
        return false;
      }
    },
    [user, toast]
  );

  const toggleFavorite = useCallback(
    async (productId: string, product?: Product): Promise<boolean> => {
      if (!productId) return false;

      if (favoriteIdsRef.current.includes(productId)) {
        return removeFavorite(productId);
      } else {
        return addFavorite(productId, product);
      }
    },
    [addFavorite, removeFavorite]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favoriteIds,
        favoriteProducts,
        loading,
        isFavorited,
        isFavorite: isFavorited,
        toggleFavorite,
        addFavorite,
        removeFavorite,
        refreshFavorites: fetchFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}

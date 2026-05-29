import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BasketItem {
  recipeId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  servings: number;
  baseServings: number;
}

interface BasketStore {
  items: BasketItem[];
  addItem: (item: Omit<BasketItem, "servings">) => void;
  removeItem: (recipeId: string) => void;
  updateServings: (recipeId: string, servings: number) => void;
  clearBasket: () => void;
  hasItem: (recipeId: string) => boolean;
}

export const useBasketStore = create<BasketStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        if (get().hasItem(item.recipeId)) return;
        set((s) => ({
          items: [...s.items, { ...item, servings: item.baseServings }],
        }));
      },

      removeItem: (recipeId) => {
        set((s) => ({ items: s.items.filter((i) => i.recipeId !== recipeId) }));
      },

      updateServings: (recipeId, servings) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.recipeId === recipeId ? { ...i, servings: Math.max(1, servings) } : i
          ),
        }));
      },

      clearBasket: () => set({ items: [] }),

      hasItem: (recipeId) => get().items.some((i) => i.recipeId === recipeId),
    }),
    { name: "onetapchef-basket" }
  )
);

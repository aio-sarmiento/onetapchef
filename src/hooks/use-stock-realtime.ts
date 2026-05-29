"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to vendor_stock changes for a specific set of ingredient IDs.
 * When any matching stock row changes, invalidates the recipe query so the
 * ingredient availability chips update live without a manual refresh.
 */
export function useStockRealtime(recipeId: string, ingredientIds: string[]) {
  const qc = useQueryClient();
  const ingredientKey = ingredientIds.join(",");

  useEffect(() => {
    if (!ingredientKey) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`stock-for-recipe-${recipeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_stock",
          filter: `ingredient_id=in.(${ingredientKey})`,
        },
        () => {
          // Invalidate this recipe so ingredient availability re-fetches
          qc.invalidateQueries({ queryKey: ["recipe", recipeId] });
          // Also invalidate the browse list so availability scores refresh
          qc.invalidateQueries({ queryKey: ["recipes"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, ingredientKey, qc]);
}

/**
 * Subscribes to all vendor_stock changes and invalidates the browse recipe list.
 * Used on the /browse page to keep the availability filter current.
 */
export function useGlobalStockRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("global-stock-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_stock" },
        () => {
          qc.invalidateQueries({ queryKey: ["recipes"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

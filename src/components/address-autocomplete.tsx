"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NominatimResult = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
};

type SelectedAddress = {
  displayName: string;
  postcode: string;
  lat: number;
  lon: number;
};

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (addr: SelectedAddress) => void;
  className?: string;
}

function isMadridAddress(result: NominatimResult): boolean {
  const a = result.address;
  const cityFields = [a.city, a.town, a.municipality, a.suburb].map((f) => (f ?? "").toLowerCase());
  const state = (a.state ?? "").toLowerCase();
  return (
    cityFields.some((f) => f === "madrid") ||
    state.includes("community of madrid") ||
    state.includes("comunidad de madrid")
  );
}

export function AddressAutocomplete({ value, onChange, onAddressSelect, className }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced Nominatim search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setError("");

    if (query.length < 4) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          format: "json",
          q: `${query}, Madrid`,
          countrycodes: "es",
          limit: "6",
          addressdetails: "1",
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { "Accept-Language": "en" },
        });
        const data: NominatimResult[] = await res.json();
        const madridOnly = data.filter(isMadridAddress);
        setResults(madridOnly);
        setOpen(madridOnly.length > 0);
      } catch {
        setError("Could not fetch address suggestions.");
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query]);

  function handleSelect(result: NominatimResult) {
    if (!isMadridAddress(result)) {
      setError("Address must be within Madrid.");
      return;
    }
    const postcode = result.address.postcode ?? "";
    const displayName = result.display_name;
    const addr: SelectedAddress = {
      displayName,
      postcode,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    };
    setSelected(addr);
    setQuery(displayName);
    onChange(displayName);
    onAddressSelect?.(addr);
    setOpen(false);
    setResults([]);
    setError("");
  }

  function handleInputChange(val: string) {
    setQuery(val);
    onChange(val);
    setSelected(null);
  }

  const mapUrl = selected
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.lon - 0.004},${selected.lat - 0.004},${selected.lon + 0.004},${selected.lat + 0.004}&layer=mapnik&marker=${selected.lat},${selected.lon}`
    : null;

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Start typing a Madrid address…"
          className="pl-9"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && results.length > 0 && (
        <div className="border rounded-lg divide-y shadow-md bg-background z-50 max-h-52 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors"
              onClick={() => handleSelect(r)}
            >
              <p className="font-medium line-clamp-1">{r.display_name.split(",")[0]}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.display_name}</p>
            </button>
          ))}
        </div>
      )}

      {/* Validation error */}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Selected: postcode + map preview */}
      {selected && (
        <div className="space-y-2">
          {selected.postcode && (
            <p className="text-xs text-muted-foreground">
              Postal code: <span className="font-semibold text-foreground">{selected.postcode}</span>
            </p>
          )}
          <div className="rounded-lg overflow-hidden border h-44 w-full">
            <iframe
              title="Delivery location"
              src={mapUrl!}
              className="w-full h-full"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors
          </p>
        </div>
      )}
    </div>
  );
}

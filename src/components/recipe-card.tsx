import Link from "next/link";
import Image from "next/image";
import { Clock, Users, ChefHat, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  baseServings: number;
  category: string;
  availabilityScore: number;
  author: { displayName: string };
  source?: string;
  isSaved?: boolean;
  isSelected?: boolean;
  onSaveToggle?: (id: string) => void;
  onSelect?: (id: string) => void;
  selectMode?: boolean;
}

function AvailabilityBadge({ score }: { score: number }) {
  if (score >= 1) return <Badge variant="available">Fully available</Badge>;
  if (score >= 0.5) return <Badge variant="low">Partially available</Badge>;
  if (score > 0) return <Badge variant="expiring">Some missing</Badge>;
  return <Badge variant="unavailable">Not available</Badge>;
}

export function RecipeCard({
  id,
  slug,
  title,
  description,
  imageUrl,
  prepTimeMinutes,
  cookTimeMinutes,
  baseServings,
  category,
  availabilityScore,
  author,
  source,
  isSaved = false,
  isSelected = false,
  onSaveToggle,
  onSelect,
  selectMode = false,
}: RecipeCardProps) {
  const isDefault = source === "themealdb";
  const totalTime = prepTimeMinutes + cookTimeMinutes;
  const score = Number(availabilityScore);

  function handleClick(e: React.MouseEvent) {
    if (selectMode && onSelect) {
      e.preventDefault();
      onSelect(id);
    }
  }

  return (
    <Link href={`/recipes/${slug}`} onClick={handleClick}>
      <Card
        className={cn(
          "overflow-hidden hover:shadow-md transition-all h-full flex flex-col cursor-pointer",
          score === 0 && !selectMode && "opacity-60",
          isSelected && "ring-2 ring-brand ring-offset-1"
        )}
      >
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <ChefHat className="h-12 w-12" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <AvailabilityBadge score={score} />
          </div>

          {/* Save button */}
          {onSaveToggle && !selectMode && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveToggle(id); }}
              className={cn(
                "absolute top-2 right-2 rounded-full p-1.5 transition-colors shadow-sm",
                isSaved
                  ? "bg-brand text-white"
                  : "bg-white/80 text-muted-foreground hover:text-brand hover:bg-white"
              )}
              aria-label={isSaved ? "Unsave recipe" : "Save recipe"}
            >
              <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-current")} />
            </button>
          )}

          {/* Select checkbox */}
          {selectMode && (
            <div className={cn(
              "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
              isSelected ? "bg-brand border-brand" : "bg-white/80 border-white"
            )}>
              {isSelected && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
        </div>

        <CardContent className="pt-4 pb-4 flex flex-col flex-1 gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="bg-muted px-2 py-0.5 rounded">{category}</span>
          </div>

          <h3 className="font-semibold leading-snug line-clamp-2">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{description}</p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {totalTime}m
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {baseServings}
            </span>
            <span className="ml-auto">
              {isDefault ? (
                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">Default Recipe</span>
              ) : (
                `by ${author.displayName}`
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

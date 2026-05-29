import Link from "next/link";
import Image from "next/image";
import { Clock, Users, ChefHat } from "lucide-react";
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
}

function AvailabilityBadge({ score }: { score: number }) {
  if (score >= 1) return <Badge variant="available">Fully available</Badge>;
  if (score >= 0.5) return <Badge variant="low">Partially available</Badge>;
  if (score > 0) return <Badge variant="expiring">Some missing</Badge>;
  return <Badge variant="unavailable">Not available</Badge>;
}

export function RecipeCard({
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
}: RecipeCardProps) {
  const totalTime = prepTimeMinutes + cookTimeMinutes;
  const score = Number(availabilityScore);

  return (
    <Link href={`/recipes/${slug}`}>
      <Card
        className={cn(
          "overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col",
          score === 0 && "opacity-60"
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
            <span className="ml-auto">by {author.displayName}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

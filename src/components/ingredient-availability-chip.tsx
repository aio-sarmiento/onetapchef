import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

type Availability = "available" | "low" | "unavailable";

interface Props {
  name: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  preparationNote?: string | null;
  availability: Availability;
  bestStock?: {
    pricePerUnit: number;
    vendor: { businessName: string };
    quantityAvailable: number;
  } | null;
  scaledQuantity?: number;
}

const ICONS = {
  available: <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />,
  low: <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />,
  unavailable: <XCircle className="h-4 w-4 text-red-400 shrink-0" />,
};

const ROW_STYLES: Record<Availability, string> = {
  available: "border-green-100 bg-green-50/50",
  low: "border-yellow-100 bg-yellow-50/50",
  unavailable: "border-red-100 bg-red-50/30 opacity-70",
};

export function IngredientAvailabilityChip({
  name,
  quantity,
  unit,
  isOptional,
  preparationNote,
  availability,
  bestStock,
  scaledQuantity,
}: Props) {
  const displayQty = scaledQuantity ?? quantity;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", ROW_STYLES[availability])}>
      {ICONS[availability]}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          {isOptional && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              optional
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground mt-0.5">
          {displayQty % 1 === 0 ? displayQty : displayQty.toFixed(1)} {unit}
          {preparationNote && <span className="ml-1 italic">{preparationNote}</span>}
        </div>

        {bestStock && availability !== "unavailable" && (
          <div className="text-xs text-muted-foreground mt-1">
            {formatCurrency(Number(bestStock.pricePerUnit))}/{unit} ·{" "}
            <span className="font-medium">{bestStock.vendor.businessName}</span>
          </div>
        )}
      </div>

      <div className="text-right text-xs shrink-0">
        {availability === "available" && (
          <span className="text-green-600 font-medium">In stock</span>
        )}
        {availability === "low" && (
          <span className="text-yellow-600 font-medium">Low stock</span>
        )}
        {availability === "unavailable" && (
          <span className="text-red-500 font-medium">Unavailable</span>
        )}
      </div>
    </div>
  );
}

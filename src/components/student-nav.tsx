"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChefHat, ShoppingBasket, BookOpen, PlusCircle, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useBasketStore } from "@/stores/basket-store";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/browse", label: "Browse", icon: BookOpen },
  { href: "/recipes/new", label: "Submit Recipe", icon: PlusCircle },
  { href: "/orders", label: "My Orders", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
];

export function StudentNav() {
  const pathname = usePathname();
  const router = useRouter();
  const basketCount = useBasketStore((s) => s.items.length);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/browse" className="flex items-center gap-2 font-bold text-lg text-brand">
          <ChefHat className="h-5 w-5" />
          OneTapChef
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-brand-muted text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href="/basket">
              <ShoppingBasket className="h-5 w-5" />
              {basketCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {basketCount}
                </span>
              )}
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

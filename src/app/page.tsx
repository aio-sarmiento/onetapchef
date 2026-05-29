import Link from "next/link";
import { ChefHat, Leaf, ShoppingBasket, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-brand">
            <ChefHat className="h-6 w-6" />
            OneTapChef
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild variant="brand">
              <Link href="/auth/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="bg-brand-muted py-24 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 text-brand text-sm font-medium bg-white rounded-full px-4 py-1.5 mb-6 shadow-sm">
              <Leaf className="h-4 w-4" />
              Reducing food waste, one recipe at a time
            </div>
            <h1 className="text-5xl font-bold tracking-tight mb-6">
              Cook great meals from
              <span className="text-brand"> near-expiring ingredients</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Local vendors share ingredients at reduced cost. You browse recipes
              based on what&apos;s actually available right now — and request everything
              in one tap.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="brand" size="lg">
                <Link href="/auth/register?role=student">Browse recipes</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/register?role=vendor">List your stock</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-14">How it works</h2>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  icon: <Store className="h-8 w-8 text-brand" />,
                  title: "Vendors post stock",
                  body: "Local grocery vendors list near-expiring ingredients at reduced or zero cost.",
                },
                {
                  icon: <ChefHat className="h-8 w-8 text-brand" />,
                  title: "Browse live recipes",
                  body: "Students see only recipes they can actually make right now with available stock.",
                },
                {
                  icon: <ShoppingBasket className="h-8 w-8 text-brand" />,
                  title: "One-tap request",
                  body: "Add multiple recipes, scale portions, and send a combined request to vendors.",
                },
              ].map((step) => (
                <div key={step.title} className="text-center">
                  <div className="flex justify-center mb-4">{step.icon}</div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 px-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} OneTapChef — reducing food waste for university students.
      </footer>
    </div>
  );
}

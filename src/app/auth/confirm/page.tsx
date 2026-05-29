import Link from "next/link";
import { ChefHat, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-brand font-bold text-2xl">
            <ChefHat className="h-8 w-8" />
            OneTapChef
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Email confirmed!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your email has been confirmed. You can now sign in to your account.
            </p>
            <Button asChild variant="brand" className="w-full">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

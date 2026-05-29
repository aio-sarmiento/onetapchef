import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { studentProfile: true },
  });
  if (!dbUser) redirect("/auth/login");

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Account details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{dbUser.displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{dbUser.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{dbUser.role}</span>
          </div>
        </CardContent>
      </Card>

      {dbUser.studentProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4" />
              Student info
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">University</span>
              <span className="font-medium">{dbUser.studentProfile.university ?? "Not set"}</span>
            </div>
            {dbUser.studentProfile.dietaryTags.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Dietary tags</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {dbUser.studentProfile.dietaryTags.map((tag) => (
                    <span key={tag} className="bg-muted px-2 py-0.5 rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

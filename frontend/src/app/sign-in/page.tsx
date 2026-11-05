import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getSession, SignInPanel } from "@/features/auth";
import { safeNextPath } from "@/lib/safeRedirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  const session = await getSession();
  if (session.user) redirect(next); // already signed in

  return (
    <Container size="narrow" className="py-12">
      <Card className="mx-auto max-w-md">
        <SignInPanel
          providers={session.providers}
          next={next}
          error={error}
          reachable={session.reachable}
        />
      </Card>
    </Container>
  );
}

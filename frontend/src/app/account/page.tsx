import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { AccountDetails, DeleteAccount, getSession } from "@/features/auth";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function AccountPage() {
  const { user, csrfToken } = await getSession();
  if (!user || !csrfToken) redirect(`/sign-in?next=${encodeURIComponent("/account")}`);

  return (
    <Container size="narrow" className="py-8">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Your account</h1>
        <AccountDetails user={user} />
        <Card as="div">
          <DeleteAccount csrfToken={csrfToken} />
        </Card>
      </div>
    </Container>
  );
}

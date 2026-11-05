import { Card } from "@/components/ui/Card";
import type { User } from "./types";

export function AccountDetails({ user }: { user: User }) {
  return (
    <Card as="section" aria-labelledby="profile-heading" className="space-y-3">
      <h2 id="profile-heading" className="text-xl font-semibold">
        Profile
      </h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted text-sm">Name</dt>
          <dd>{user.name ?? "Not provided"}</dd>
        </div>
        <div>
          <dt className="text-fg-muted text-sm">Email</dt>
          <dd className="break-all">{user.email}</dd>
        </div>
      </dl>
    </Card>
  );
}

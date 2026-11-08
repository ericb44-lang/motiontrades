import { Link, useLocation } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketHydrated, useMe } from "@/lib/marketplace/store";
import type { Collector } from "@/lib/marketplace/types";
import { EmptyState } from "./bits";

/** Renders children only for a signed-in collector; otherwise invites the visitor to join. */
export function RequireCollector({
  title = "Log in to keep going",
  body = "Log in or make a free account to list figures, make offers and manage trades.",
  children,
}: {
  title?: string;
  body?: string;
  children: (me: Collector) => React.ReactNode;
}) {
  const hydrated = useMarketHydrated();
  const me = useMe();
  const location = useLocation();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <EmptyState
          title={title}
          body={body}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="hero">
                <Link to="/login" search={{ redirect: location.pathname }}>
                  <LogIn /> Log in
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/join" search={{ redirect: location.pathname }}>
                  <UserPlus /> Join
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return <>{children(me)}</>;
}

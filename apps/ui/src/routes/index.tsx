import {
  HealthIcon,
  LiveStreamingIcon,
  MessageQuestionIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "~/components/ui/card";

export const Route = createFileRoute("/")({
  component: Home,
});

const navCards: { to: string; icon: IconSvgElement; label: string }[] = [
  { to: "/questions", icon: MessageQuestionIcon, label: "Questions" },
  { to: "/streaming", icon: LiveStreamingIcon, label: "Streaming" },
  { to: "/health", icon: HealthIcon, label: "Health" },
];

function Home() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
      {navCards.map(({ to, icon, label }) => (
        <Link key={to} to={to}>
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <HugeiconsIcon icon={icon} className="size-8 text-primary" />
              <span className="font-semibold text-lg">{label}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

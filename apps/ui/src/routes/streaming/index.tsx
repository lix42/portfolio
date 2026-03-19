import { Md } from "@m2d/react-markdown";
import type { StreamEvent } from "@portfolio/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useStreamChat } from "~/lib/useStreamChat";

const question =
  "Tell me an example about how you cooperate with other people.";

export const Route = createFileRoute("/streaming/")({
  component: Streaming,
});

function eventLabel(ev: StreamEvent): string {
  switch (ev.event) {
    case "status":
      return ev.data.message;
    case "context":
      return `${ev.data.chunksCount} context chunks`;
    default:
      return ev.event;
  }
}

function EventBadge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {label}
    </span>
  );
}

function PipelineEvents({ events }: { events: StreamEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {events.map((ev, i) => (
        <EventBadge key={`${ev.event}-${i}`} label={eventLabel(ev)} />
      ))}
    </div>
  );
}

function Streaming() {
  const { status, answer, events, error, send, abort } = useStreamChat();

  useEffect(() => {
    send(question);
    return () => abort();
  }, [send, abort]);

  return (
    <Card className="px-2 sm:px-4 max-w-2xl mx-auto">
      <h2 className="text-xl text-primary font-bold">{question}</h2>

      <PipelineEvents events={events} />

      {status === "error" && <p className="text-destructive">Error: {error}</p>}

      {status === "streaming" && !answer && <Skeleton />}

      {answer && <Md>{answer}</Md>}
    </Card>
  );
}

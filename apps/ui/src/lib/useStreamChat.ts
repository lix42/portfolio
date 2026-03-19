import type { StreamEvent } from "@portfolio/shared";
import { useCallback, useRef, useState } from "react";
import { streamJSONLEvents } from "./jsonl";

type Status = "idle" | "streaming" | "done" | "error";

interface StreamChatState {
  status: Status;
  answer: string;
  events: StreamEvent[];
  error: string | null;
}

const initialState: StreamChatState = {
  status: "idle",
  answer: "",
  events: [],
  error: null,
};

export function useStreamChat() {
  const [state, setState] = useState<StreamChatState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async (question: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...initialState, status: "streaming" });

    try {
      const response = await fetch("/api/chat-jsonl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = (await response.json()) as Record<string, unknown>;
          if (typeof body["error"] === "string") detail = body["error"];
        } catch {
          // body wasn't JSON, fall back to statusText
        }
        setState((s) => ({
          ...s,
          status: "error",
          error: `HTTP ${response.status}: ${detail}`,
        }));
        return;
      }

      for await (const event of streamJSONLEvents(response)) {
        if (controller.signal.aborted) return;

        switch (event.event) {
          case "chunk":
            setState((s) => ({ ...s, answer: s.answer + event.data.text }));
            break;
          case "done":
            setState((s) => ({
              ...s,
              status: "done",
              answer: event.data.answer,
            }));
            break;
          case "error":
            setState((s) => ({
              ...s,
              status: "error",
              error: event.data.error,
            }));
            break;
          default:
            setState((s) => ({ ...s, events: [...s.events, event] }));
            break;
        }
      }

      setState((s) =>
        s.status === "streaming"
          ? {
              ...s,
              status: "error",
              error:
                "Stream ended unexpectedly — the response may be incomplete.",
            }
          : s,
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("[useStreamChat] Stream failed:", err);
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  return { ...state, send, abort };
}

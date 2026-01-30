import { Md } from "@m2d/react-markdown";
import { isErrorChat, isSuccessChat } from "@portfolio/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { answerQueryOptions } from "~/lib/qna";

const firstQuestion =
  "Tell me an example about how you cooperate with other people.";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(
      answerQueryOptions(firstQuestion),
    );

    return data;
  },
  component: Home,
});

function Home() {
  const { data, isLoading, isError, error } = useQuery(
    answerQueryOptions(firstQuestion),
  );
  return (
    <Card className="px-2 sm:px-4">
      <h2 className="text-xl text-primary font-bold">{firstQuestion}</h2>
      {isLoading && <Skeleton />}
      {isError && <p className="text-destructive">Error: {String(error)}</p>}
      {!isLoading && !isError && data && isErrorChat(data) && (
        <p className="text-destructive">Error: {data.error}</p>
      )}
      {!isLoading && !isError && data && isSuccessChat(data) && (
        <Md>{data.answer}</Md>
      )}
    </Card>
  );
}

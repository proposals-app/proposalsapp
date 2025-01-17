import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { PostHogIdentifier } from "./providers/posthog-identifier";

export default async function Home(props: {
  searchParams: Promise<{
    state: string;
    dao: string | string[];
  }>;
}) {
  return (
    <div className="flex w-full flex-col gap-12 px-4 pb-40 pt-14">
      <div className="flex w-full flex-col items-center gap-8">
        <PostHogIdentifier />
        <Card>
          <CardHeader>
            <CardTitle>workin on it</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

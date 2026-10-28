import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runAutomation } from "@/lib/automation.server";

export const Route = createFileRoute("/api/public/jobs/auto-posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const result = await runAutomation();
        return Response.json(result);
      },
    },
  },
});

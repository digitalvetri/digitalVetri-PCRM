import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /api/cron/* is authenticated by CRON_SECRET (assertCron), not Clerk, so a
// scheduler with no session can reach it.
// Only the exact cron endpoint is Clerk-exempt (it is gated by CRON_SECRET via
// assertCron). Kept narrow so a future /api/cron/* route isn't public by default.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/cron/daily"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

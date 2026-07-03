import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /api/cron/* is authenticated by CRON_SECRET (assertCron), not Clerk, so a
// scheduler with no session can reach it.
// Clerk-exempt routes: auth pages, the CRON_SECRET-gated cron endpoint, and the
// public inbound-enquiry page + its intake API (spam-gated, not auth-gated).
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron/daily",
  "/enquiry",
  "/api/public/enquiry",
]);

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

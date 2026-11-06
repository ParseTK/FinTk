/** Liveness for the container health check and uptime monitors: answers without calling the API. */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
  });
}

import { after, NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { isAuthorEmail } from "@/lib/access";
import { isProductionDeployment } from "@/lib/visit-alert-policy";
import { getNowUnixSeconds } from "@/lib/date-utils";
import { recordLinkClick } from "@/lib/link-clicks";

/**
 * Follows a thought's link for a signed-in reader, counting the open on the
 * way through. Signed-out requests go to sign-in, so the destination is never
 * revealed to someone who could not see the note it belongs to.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  const thought = Number.isInteger(id) && id > 0
    ? await db
        .select({
          id: thoughts.id,
          link: thoughts.link,
          note: thoughts.note,
          createdAt: thoughts.createdAt,
        })
        .from(thoughts)
        .where(eq(thoughts.id, id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const link = thought?.link;
  if (!thought || !link || !/^https?:\/\//i.test(link)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const email = session.user.email ?? null;
  const tracked =
    email &&
    !isAuthorEmail(email) &&
    isProductionDeployment({
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
    });
  if (tracked) {
    const click = {
      thought: { ...thought, link },
      email,
      userAgent: req.headers.get("user-agent")?.slice(0, 1024) ?? null,
      clickedAt: getNowUnixSeconds(),
    };
    // Recorded after the redirect goes out, so the link opens without waiting.
    after(() =>
      recordLinkClick(click).catch((error) => {
        console.error("Failed to record link click:", error);
      })
    );
  }

  return NextResponse.redirect(link);
}

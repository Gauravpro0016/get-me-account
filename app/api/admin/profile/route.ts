import { NextRequest, NextResponse } from "next/server";
import { getAdminProfilePic, setAdminProfilePic } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const provided = req.headers.get("x-admin-password") || bearer;
  return provided === adminPassword;
}


export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profilePic = await getAdminProfilePic();
    return NextResponse.json({
      success: true,
      profilePic: profilePic || "/admin-profile.jpg",
    });
  } catch (error) {
    console.error("Failed to get admin profile pic:", error);
    return NextResponse.json(
      { error: "Failed to get profile pic" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const profilePic = typeof body.profilePic === "string" ? body.profilePic.trim() : "";

    await setAdminProfilePic(profilePic);

    return NextResponse.json({
      success: true,
      profilePic: profilePic || "/admin-profile.jpg",
      message: "Admin profile picture updated successfully",
    });
  } catch (error) {
    console.error("Failed to update admin profile pic:", error);
    return NextResponse.json(
      { error: "Failed to update profile pic" },
      { status: 500 }
    );
  }
}

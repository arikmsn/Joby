import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "./types";
import type { UserRole } from "./constants";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production-min-32-chars!"
);
const JWT_ISSUER = "joby-shiftmatch";
const JWT_EXPIRY = "7d";

export async function signToken(payload: {
  userId: string;
  role: UserRole;
}): Promise<string> {
  return new SignJWT({ sub: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; role: UserRole } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });
    if (!payload.sub || !payload.role) return null;
    return { userId: payload.sub, role: payload.role as UserRole };
  } catch {
    return null;
  }
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function extractUser(
  req: NextRequest
): Promise<AuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const decoded = await verifyToken(token);
  if (!decoded) return null;

  const rows = await db
    .select({
      id: users.id,
      phone: users.phone,
      role: users.role,
      full_name: users.full_name,
      is_active: users.is_active,
    })
    .from(users)
    .where(eq(users.id, decoded.userId))
    .limit(1);

  const user = rows[0];
  if (!user) return null;
  if (!user.is_active) return null;

  return user as AuthUser;
}

export async function requireAuth(
  req: NextRequest
): Promise<AuthUser | NextResponse> {
  const user = await extractUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "נדרשת הזדהות" },
      { status: 401 }
    );
  }
  return user;
}

export async function requireRole(
  req: NextRequest,
  role: UserRole
): Promise<AuthUser | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  if (result.role !== role) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "אין הרשאה לפעולה זו" },
      { status: 403 }
    );
  }
  return result;
}

export async function requireRoles(
  req: NextRequest,
  roles: UserRole[]
): Promise<AuthUser | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  if (!roles.includes(result.role as UserRole)) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "אין הרשאה לפעולה זו" },
      { status: 403 }
    );
  }
  return result;
}

import { NextResponse } from "next/server";
import { isDashboardAuthenticated } from "@/lib/auth/dashboard-auth";
import { invalidateActiveRulesCache } from "@/lib/openai/active-rules";
import {
  createAdminRule,
  deleteAdminRule,
  listAdminRules,
  updateAdminRule,
} from "@/lib/supabase/admin-rules";
import { toErrorMessage } from "@/lib/supabase/errors";

const RULES_ERROR_CONTEXT = {
  table: "admin_rules",
  migration: "supabase/migrations/RUN_PENDING.sql",
} as const;

export const runtime = "nodejs";

export async function GET() {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rules = await listAdminRules(false);
    return NextResponse.json({ rules });
  } catch (e) {
    const message = toErrorMessage(e, "Failed to list rules", RULES_ERROR_CONTEXT);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const ruleBody = String(body.body ?? "").trim();
    if (!title || !ruleBody) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    const rule = await createAdminRule({
      title,
      body: ruleBody,
      category: body.category ? String(body.category).trim() : null,
      active: body.active !== false,
      sort_order: Number(body.sort_order) || 0,
    });
    invalidateActiveRulesCache();
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    const message = toErrorMessage(e, "Failed to create rule", RULES_ERROR_CONTEXT);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Parameters<typeof updateAdminRule>[1] = {};
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.body !== undefined) updates.body = String(body.body).trim();
    if (body.category !== undefined) {
      updates.category = body.category
        ? String(body.category).trim()
        : null;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.sort_order !== undefined) {
      updates.sort_order = Number(body.sort_order) || 0;
    }

    const rule = await updateAdminRule(id, updates);
    invalidateActiveRulesCache();
    return NextResponse.json({ rule });
  } catch (e) {
    const message = toErrorMessage(e, "Failed to update rule", RULES_ERROR_CONTEXT);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isDashboardAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "id query required" }, { status: 400 });
    }
    await deleteAdminRule(id);
    invalidateActiveRulesCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = toErrorMessage(e, "Failed to delete rule", RULES_ERROR_CONTEXT);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

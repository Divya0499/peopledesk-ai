import {
  createEmployee,
  createEmployeeSchema,
  firstIssue,
  listEmployees,
} from "@/lib/employees";
import { requireAdmin } from "@/lib/session";

// Employee management is admin-only: it sets roles, managers, balances and
// passwords. Checked before the body is read.
export async function GET() {
  const { error } = await requireAdmin();

  if (error) return error;

  try {
    return Response.json({ employees: await listEmployees() });
  } catch (err) {
    console.error(err);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();

  if (error) return error;

  const body = createEmployeeSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!body.success) {
    return Response.json({ error: firstIssue(body.error) }, { status: 400 });
  }

  try {
    const result = await createEmployee(body.data);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ id: result.id }, { status: 201 });
  } catch (err) {
    console.error(err);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

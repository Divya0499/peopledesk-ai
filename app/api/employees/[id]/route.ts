import {
  firstIssue,
  updateEmployee,
  updateEmployeeSchema,
} from "@/lib/employees";
import { createSession, requireAdmin } from "@/lib/session";

// An admin changes an employee's details, manager, role, balance or password
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAdmin();

  if (error) return error;

  const body = updateEmployeeSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!body.success) {
    return Response.json({ error: firstIssue(body.error) }, { status: 400 });
  }

  try {
    const { id } = await params;
    const result = await updateEmployee(user, id, body.data);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    // changing your own password logs out your other sessions, not this one
    if (id === user.userId && body.data.password) {
      await createSession(user.userId);
    }

    return Response.json({ id: result.id });
  } catch (err) {
    console.error(err);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

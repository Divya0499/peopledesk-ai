import { expect, test } from "@playwright/test";

import { appAlert, login, logout, users } from "./helpers";

test("an admin adds an employee who can then log in", async ({ page }) => {
  await login(page, users.admin.email);
  await page.goto("/admin/employees");

  await page.getByRole("button", { name: "Add employee" }).click();
  await page.getByLabel("Name").fill("Tara Iyer");
  await page.getByLabel("Email").fill("tara@peopledesk.dev");
  await page.getByLabel("Department").fill("Engineering");
  await page.getByLabel("Manager").selectOption({ label: users.manager.name });
  await page.getByLabel("Password").fill("Welcome@123");
  await page.getByRole("button", { name: "Add employee" }).click();

  const row = page.getByRole("row", { name: /Tara Iyer/ });
  await expect(row).toContainText(users.manager.name);
  await logout(page);

  await login(page, "tara@peopledesk.dev", "Welcome@123");
});

test("the server's validation messages reach the form", async ({ page }) => {
  await login(page, users.admin.email);
  await page.goto("/admin/employees");

  await page.getByRole("button", { name: "Add employee" }).click();
  await page.getByLabel("Name").fill("Copy");
  await page.getByLabel("Email").fill(users.employee.email);
  await page.getByLabel("Department").fill("Engineering");
  await page.getByLabel("Password").fill("Welcome@123");
  await page.getByRole("button", { name: "Add employee" }).click();

  await expect(appAlert(page)).toHaveText(
    "An employee with that email already exists",
  );
});

test("an admin can't remove their own admin role", async ({ page }) => {
  await login(page, users.admin.email);
  await page.goto("/admin/employees");

  await page.getByRole("button", { name: `Edit ${users.admin.name}` }).click();
  await page.getByLabel("Role").selectOption("employee");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(appAlert(page)).toHaveText("You can't remove your own admin role");
});

test("changing a manager moves the employee's approvals", async ({ page }) => {
  await login(page, users.admin.email);
  await page.goto("/admin/employees");

  // Tara (added above) now reports to the admin instead of Vikram
  await page.getByRole("button", { name: "Edit Tara Iyer" }).click();
  await page.getByLabel("Manager").selectOption({ label: users.admin.name });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("row", { name: /Tara Iyer/ })).toContainText(
    users.admin.name,
  );
  await logout(page);

  await login(page, "tara@peopledesk.dev", "Welcome@123");
  await page.goto("/leave");
  await page.getByLabel("Days").fill("1");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(/sent to Asha Rao for approval/)).toBeVisible();
});

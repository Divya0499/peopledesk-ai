import { expect, test } from "@playwright/test";

import { appAlert, login, logout, users } from "./helpers";

test.describe("login", () => {
  test("rejects a wrong password with a generic message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(users.employee.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(appAlert(page)).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/login/);
    // The form can be tried again
    await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  test("a demo account button fills the form and logs in", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Manager/ }).click();
    await expect(page.getByLabel("Email")).toHaveValue(users.manager.email);

    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test("logging out ends the session", async ({ page }) => {
    await login(page, users.employee.email);
    await logout(page);

    await page.goto("/leave");
    await expect(page).toHaveURL(/\/login/);
  });

  test("pages need a session", async ({ page }) => {
    for (const path of ["/chat", "/leave", "/admin/employees"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe("roles", () => {
  test("an employee sees no admin controls and can't open admin pages", async ({
    page,
  }) => {
    await login(page, users.employee.email);

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Employees" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload PDFs" })).toHaveCount(
      0,
    );

    await page.goto("/admin/employees");
    await expect(page).toHaveURL(/\/chat/);
  });

  test("an admin sees document upload and employee management", async ({
    page,
  }) => {
    await login(page, users.admin.email);

    await expect(
      page.getByRole("button", { name: "Upload PDFs" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Employees" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Employees" }),
    ).toBeVisible();
  });
});

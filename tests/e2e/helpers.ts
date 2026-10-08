import { expect, type Page } from "@playwright/test";

// The accounts prisma/seed.ts creates
export const DEMO_PASSWORD = "PeopleDesk@123";
export const users = {
  admin: { email: "asha@peopledesk.dev", name: "Asha Rao" },
  manager: { email: "vikram@peopledesk.dev", name: "Vikram Shah" },
  employee: { email: "neha@peopledesk.dev", name: "Neha Gupta" },
  employee2: { email: "rohan@peopledesk.dev", name: "Rohan Das" },
};

export async function login(
  page: Page,
  email: string,
  password = DEMO_PASSWORD,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/chat/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

// The app's own error messages (Next.js also renders an empty role=alert
// route announcer, so match the paragraph)
export const appAlert = (page: Page) => page.locator("p[role=alert]");

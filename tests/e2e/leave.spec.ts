import { expect, type Page, test } from "@playwright/test";

import { appAlert, login, logout, users } from "./helpers";

async function openLeave(page: Page) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Leave" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request leave" }),
  ).toBeVisible();
}

const available = (page: Page) =>
  page.getByText("Days available to request").locator("..").locator("p").nth(1);

test("an employee requests leave and their manager approves it", async ({
  page,
}) => {
  await login(page, users.employee.email);
  await openLeave(page);
  const before = Number(await available(page).innerText());

  await page.getByLabel("Days").fill("3");
  await page.getByLabel(/Reason/).fill("Sister's wedding");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(
    page.getByText(/sent to Vikram Shah for approval/),
  ).toBeVisible();
  // The days are reserved straight away
  await expect(available(page)).toHaveText(String(before - 3));
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  await logout(page);

  await login(page, users.manager.email);
  await openLeave(page);
  await page.getByLabel(`Note for ${users.employee.name}`).fill("Enjoy!");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Nothing waiting")).toBeVisible();
  await logout(page);

  await login(page, users.employee.email);
  await openLeave(page);
  await expect(
    page.getByText("Approved by Vikram Shah: “Enjoy!”"),
  ).toBeVisible();
  await expect(available(page)).toHaveText(String(before - 3));
});

test("a rejected request gives the days back", async ({ page }) => {
  await login(page, users.employee2.email);
  await openLeave(page);
  const before = Number(await available(page).innerText());

  await page.getByLabel("Days").fill("2");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(available(page)).toHaveText(String(before - 2));
  await logout(page);

  await login(page, users.manager.email);
  await openLeave(page);

  // a rejection needs a reason; without one nothing is sent
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(appAlert(page)).toHaveText(
    "Add a reason so the employee knows why their leave was rejected.",
  );
  await expect(page.getByText("Nothing waiting")).toHaveCount(0);

  await page
    .getByLabel(`Note for ${users.employee2.name}`)
    .fill("Release week, please pick other dates");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Nothing waiting")).toBeVisible();
  await logout(page);

  await login(page, users.employee2.email);
  await openLeave(page);
  await expect(page.getByText("rejected", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Rejected by Vikram Shah: “Release week, please pick other dates”",
    ),
  ).toBeVisible();
  await expect(available(page)).toHaveText(String(before));
});

test("an employee can cancel a pending request", async ({ page }) => {
  await login(page, users.employee2.email);
  await openLeave(page);
  const before = Number(await available(page).innerText());

  await page.getByLabel("Days").fill("1");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(available(page)).toHaveText(String(before - 1));

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(available(page)).toHaveText(String(before));
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("a request over the balance is refused", async ({ page }) => {
  await login(page, users.employee.email);
  await openLeave(page);
  const before = Number(await available(page).innerText());

  // The form's max stops this in the browser, so bypass it to check the server
  await page
    .getByLabel("Days")
    .evaluate((input) => input.removeAttribute("max"));
  await page.getByLabel("Days").fill(String(before + 1));
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText("Insufficient leave balance")).toBeVisible();
  await expect(available(page)).toHaveText(String(before));
});

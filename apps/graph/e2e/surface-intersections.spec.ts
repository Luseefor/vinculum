import { expect, test } from "@playwright/test";
import { addObject } from "./helpers/addObject";
import { fillInput, expectInputVisible } from "./helpers/mathInput";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("vinculum-welcome-onboarding-v1",JSON.stringify({version:1,dismissed:true,updatedAt:new Date().toISOString()}));
  });
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/editor");
});

test("3D parametric search creates a surface from 2D", async ({ page }) => {
  await page.getByRole("group",{name:"View type"}).getByRole("button",{name:"2D only",exact:true}).click();
  await page.getByRole("button",{name:"Open object menu"}).click();
  await page.getByRole("searchbox", { name: "Search objects", exact: true }).fill("3d parametric");
  await expect(page.getByRole("button",{name:"Parametric Curve",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Parametric Surface",exact:true}).click();
  await expect(page.getByTestId("scene-object-count")).toHaveText("1");
  await expect(page.getByRole("group",{name:"View type"}).getByRole("button",{name:"3D only",exact:true})).toHaveAttribute("aria-pressed","true");
  await expectInputVisible(page.locator("#graph-inspector").getByLabel("Parametric surface x(u,v)",{exact:true}));
  await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
});

test("surface and plane show an intersection curve and solution, then update after editing", async ({ page }) => {
  const errors: string[]=[];
  page.on("pageerror",error => errors.push(error.message));
  await addObject(page,"Parametric Sphere");
  await addObject(page,"Slice Plane");
  await page.getByRole("tab",{name:"Analyze",exact:true}).click();
  const select=page.getByLabel("Second object for geometry analysis");
  const value=await select.locator("option").filter({hasText:"Parametric Surface"}).getAttribute("value");
  await select.selectOption(value!);
  await expect(page.getByTestId("surface-intersection-result")).toHaveText(/Intersection curve found/);
  await page.getByRole("switch",{name:"Show intersection curve",exact:true}).click();
  await page.getByText("Solution",{exact:true}).click();
  await expect(page.getByTestId("intersection-reduced-equation")).toBeVisible();
  await expect(page.getByText("Sample point 1",{exact:true})).toBeVisible();
  await expect(page.locator('canvas[data-graph3d-canvas="true"]').first()).toBeVisible();
  await page.getByRole("tab",{name:"Edit",exact:true}).click();
  await fillInput(page.locator("#graph-inspector").getByLabel("Plane equation",{exact:true}),"z=3");
  await page.getByRole("tab",{name:"Analyze",exact:true}).click();
  await expect(page.getByTestId("surface-intersection-result")).toHaveText(/No sampled intersection/);
  await expect(page.getByRole("switch",{name:"Show intersection curve"})).toHaveCount(0);
  expect(errors).toEqual([]);
});

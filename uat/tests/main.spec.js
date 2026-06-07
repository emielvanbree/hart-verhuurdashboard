const { test, expect } = require('@playwright/test');

test.describe('Auth', () => {
  test('TC-001 — Unauthenticated redirect to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  });

  test('TC-002 — Login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test('TC-003 — Admin login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'assistent@thart.nl');
    await page.fill('[data-testid="password-input"]', 'Assistent123!');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="stats-grid"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'assistent@thart.nl');
    await page.fill('[data-testid="password-input"]', 'Assistent123!');
    await page.click('[data-testid="login-btn"]');
    await expect(page.locator('[data-testid="stats-grid"]')).toBeVisible({ timeout: 10000 });
  });

  test('TC-004 — Dashboard shows stats and quick actions', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-new-reservation"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-walk-in"]')).toBeVisible();
  });

  test('TC-005 — Navigate to reservations', async ({ page }) => {
    await page.click('[data-testid="nav-reservations"]');
    await expect(page.locator('[data-testid="btn-new-reservation"]')).toBeVisible();
  });
});

test.describe('Reservation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'assistent@thart.nl');
    await page.fill('[data-testid="password-input"]', 'Assistent123!');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL(/^\/((?!login).)*$/);
  });

  test('TC-006 — Create new reservation with new client', async ({ page }) => {
    await page.goto('/reservations/new');
    await expect(page.locator('[data-testid="step-client"]')).toBeVisible();
    await page.click('[data-testid="btn-new-client"]');
    await page.fill('[data-testid="new-client-name"]', 'Playwright Testcliënt');
    await page.fill('[data-testid="new-client-email"]', 'playwright@test.nl');
    await page.fill('[data-testid="new-client-due-date"]', '2027-03-15');
    await page.click('[data-testid="btn-next"]');
    await expect(page.locator('[data-testid="step-articles"]')).toBeVisible();
    await expect(page.locator('[data-testid="article-list"]')).toBeVisible();
    const firstCheckbox = page.locator('[data-testid^="article-checkbox-"]').first();
    await firstCheckbox.check();
    await page.click('[data-testid="btn-next"]');
    await expect(page.locator('[data-testid="step-confirm"]')).toBeVisible();
    await page.click('[data-testid="btn-next"]');
    await expect(page).toHaveURL(/reservations\/\d+/, { timeout: 15000 });
  });

  test('TC-007 — Empty article selection shows error', async ({ page }) => {
    await page.goto('/reservations/new');
    await page.click('[data-testid="btn-new-client"]');
    await page.fill('[data-testid="new-client-name"]', 'Test');
    await page.fill('[data-testid="new-client-email"]', 'test@test.nl');
    await page.fill('[data-testid="new-client-due-date"]', '2027-04-01');
    await page.click('[data-testid="btn-next"]');
    await page.click('[data-testid="btn-next"]');
    await expect(page.locator('[data-testid="alert-msg"]')).toBeVisible();
  });
});

test.describe('Walk-in rental', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'assistent@thart.nl');
    await page.fill('[data-testid="password-input"]', 'Assistent123!');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL(/^\/((?!login).)*$/);
  });

  test('TC-008 — Walk-in rental creates rental dossier', async ({ page }) => {
    await page.goto('/walk-in');
    await expect(page.locator('[data-testid="walkin-step-client"]')).toBeVisible();
    await page.click('button:has-text("Nieuwe cliënt")');
    await page.fill('[data-testid="walkin-new-name"]', 'Walk-in Testcliënt');
    await page.fill('input[type="email"]', 'walkin@test.nl');
    await page.fill('[data-testid="walkin-new-due-date"]', '2027-05-01');
    await page.click('[data-testid="walkin-btn-next"]');
    await expect(page.locator('[data-testid="walkin-step-articles"]')).toBeVisible();
    const firstCheckbox = page.locator('[data-testid^="walkin-article-"]').first();
    await firstCheckbox.check();
    await page.selectOption('[data-testid="walkin-payment"]', 'pin');
    await page.click('[data-testid="walkin-btn-next"]');
    await expect(page.locator('[data-testid="walkin-step-confirm"]')).toBeVisible();
    await page.click('[data-testid="walkin-btn-next"]');
    await expect(page).toHaveURL(/rentals\/\d+/, { timeout: 15000 });
  });
});

test.describe('Admin: Articles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@thart.nl');
    await page.fill('[data-testid="password-input"]', 'Admin123!');
    await page.click('[data-testid="login-btn"]');
    await page.goto('/change-password');
    await page.fill('[data-testid="new-password-input"]', 'NewAdmin123!');
    await page.fill('[data-testid="confirm-password-input"]', 'NewAdmin123!');
    await page.click('[data-testid="btn-change-password"]');
    await page.waitForURL(/^\/((?!login|change).)*$/, { timeout: 10000 });
  });

  test('TC-009 — Admin can add and deactivate articles', async ({ page }) => {
    await page.goto('/articles');
    await expect(page.locator('[data-testid="articles-table"]')).toBeVisible();
    await page.click('[data-testid="btn-new-article"]');
    await page.fill('[data-testid="article-name-input"]', 'Playwright Bad Test');
    await page.fill('[data-testid="article-price-input"]', '145');
    await page.selectOption('[data-testid="article-type-select"]', 'MINI');
    await page.click('[data-testid="btn-save-article"]');
    await expect(page.locator('text=Playwright Bad Test')).toBeVisible();
    const deactivateBtn = page.locator('[data-testid="btn-deactivate-article"]').last();
    await deactivateBtn.click();
    await page.click('[data-testid="confirm-btn"]');
    await expect(page.locator('text=Playwright Bad Test')).toBeVisible();
  });
});

test.describe('Admin: Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@thart.nl');
    await page.fill('[data-testid="password-input"]', 'NewAdmin123!');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL(/^\/((?!login|change).)*$/, { timeout: 10000 });
  });

  test('TC-010 — Admin can update settings and templates', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('[data-testid="tab-practice"]')).toBeVisible();
    await page.fill('[data-testid="input-practice-name"]', "'t Hart Verloskunde Test");
    await page.click('[data-testid="btn-save-settings"]');
    await expect(page.locator('[data-testid="alert-msg"]')).toBeVisible();
    await page.click('[data-testid="tab-templates"]');
    await expect(page.locator('[data-testid="input-template_agreement_conditions"]')).toBeVisible();
    await page.click('[data-testid="tab-email"]');
    await expect(page.locator('[data-testid="email-method-smtp"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-method-graph"]')).toBeVisible();
  });
});

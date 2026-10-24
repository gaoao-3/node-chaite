const { chromium } = require("/home/hina/.local/share/pi-node/node-v22.23.3-linux-x64/lib/node_modules/@agegr/pi-web/node_modules/playwright-core");
const path = require("path");
const fs = require("fs");

async function main() {
  const browser = await chromium.launch({
    executablePath: "/home/hina/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const outDir = "/tmp/ui-inspect";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Mobile Context (390 x 844, deviceScaleFactor 2)
  console.log("=== Launching Mobile Viewport (390x844) ===");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3300/", { waitUntil: "networkidle" });

  // Log in
  console.log("Logging in...");
  const pwdInput = page.locator('input[type="password"]');
  if (await pwdInput.isVisible()) {
    await pwdInput.fill("admin123456");
    await page.click('button:has-text("进入控制台")');
    await page.waitForTimeout(1000);
  }

  // 1. Capture base chat screen
  await page.waitForSelector('textarea, [placeholder*="指令"]', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "01-mobile-chat.png") });
  console.log("Saved 01-mobile-chat.png");

  // Select the test session if exists
  const sessionBtn = page.locator('button:has-text("Thinking Level")').first();
  if (await sessionBtn.isVisible()) {
    await sessionBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, "02-mobile-session-chat.png") });
    console.log("Saved 02-mobile-session-chat.png");
  }

  // Click Thinking Level button
  const thinkingBtn = page.locator('button[aria-label*="思考等级"]').first();
  if (await thinkingBtn.isVisible()) {
    await thinkingBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "03-mobile-thinking-popover.png") });
    console.log("Saved 03-mobile-thinking-popover.png");
    // Click outside or click button again to close
    await thinkingBtn.click();
    await page.waitForTimeout(300);
  }

  // Click Snippets button (Lightbulb)
  const snippetsBtn = page.locator('button[title*="提示词模板"]').first();
  if (await snippetsBtn.isVisible()) {
    await snippetsBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "04-mobile-snippets-popover.png") });
    console.log("Saved 04-mobile-snippets-popover.png");
    await snippetsBtn.click();
    await page.waitForTimeout(300);
  }

  // Click Model Selector
  const modelBtn = page.locator('button[title*="切换当前会话驱动模型"]').first();
  if (await modelBtn.isVisible()) {
    await modelBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "05-mobile-model-popover.png") });
    console.log("Saved 05-mobile-model-popover.png");
    await modelBtn.click();
    await page.waitForTimeout(300);
  }

  // Open sidebar (menu button)
  const menuBtn = page.locator('button[aria-label="切换侧栏"]').first();
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "06-mobile-sidebar.png") });
    console.log("Saved 06-mobile-sidebar.png");
    // Close sidebar
    const closeBtn = page.locator('button[title="关闭侧栏"]').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // 2. Desktop Context (1280 x 800)
  console.log("=== Launching Desktop Viewport (1280x800) ===");
  const deskContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const deskPage = await deskContext.newPage();
  await deskPage.goto("http://127.0.0.1:3300/", { waitUntil: "networkidle" });
  const deskPwd = deskPage.locator('input[type="password"]');
  if (await deskPwd.isVisible()) {
    await deskPwd.fill("admin123456");
    await deskPage.click('button:has-text("进入控制台")');
    await deskPage.waitForTimeout(1000);
  }
  await deskPage.screenshot({ path: path.join(outDir, "07-desktop-overview.png") });
  console.log("Saved 07-desktop-overview.png");

  // Open inspector drawer on desktop
  const inspectorBtn = deskPage.locator('button:has-text("协同面板")').first();
  if (await inspectorBtn.isVisible()) {
    await inspectorBtn.click();
    await deskPage.waitForTimeout(400);
    await deskPage.screenshot({ path: path.join(outDir, "08-desktop-inspector.png") });
    console.log("Saved 08-desktop-inspector.png");
  }

  await browser.close();
  console.log("=== All screenshots captured to /tmp/ui-inspect ===");
}

main().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});

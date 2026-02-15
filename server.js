const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let browser;
const MAX_PAGES = 5;
const pagePool = [];
let activePages = 0;

// ===============================
// Launch browser once
// ===============================
async function initBrowser() {
  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  console.log("✅ Browser launched");
}

initBrowser();

// ===============================
// Get page from pool
// ===============================
async function getPage() {
  if (pagePool.length > 0) {
    return pagePool.pop();
  }

  if (activePages < MAX_PAGES) {
    activePages++;
    const page = await browser.newPage();

    // Block heavy resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 " +
      "Mobile/15E148 Safari/604.1"
    );

    return page;
  }

  // Wait if too many pages
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getPage();
}

// ===============================
// Return page to pool
// ===============================
function releasePage(page) {
  pagePool.push(page);
}

// ===============================
// Extract function
// ===============================
async function extractGoogleMaps(url) {
  const page = await getPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Wait until redirect happens
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 10000,
    }).catch(() => {});

    const finalUrl = page.url();

    let lat = null;
    let lon = null;

    const match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      lat = parseFloat(match[1]);
      lon = parseFloat(match[2]);
    }

    const title = await page.title();
    const name = title.replace(" - Google Maps", "");

    return {
      name,
      latitude: lat,
      longitude: lon,
      final_url: finalUrl,
    };

  } finally {
    releasePage(page);
  }
}

// ===============================
// API Route
// ===============================
app.post("/extract", async (req, res) => {
  const start = Date.now();

  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing URL" });
    }

    const result = await extractGoogleMaps(url);

    const duration = Date.now() - start;
    res.json({ ...result, response_time_ms: duration });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

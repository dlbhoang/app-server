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

    // Anti detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36"
);


    // Block heavy resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
if (["image", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  await new Promise((r) => setTimeout(r, 100));
  return getPage();
}

// ===============================
// Release page
// ===============================
function releasePage(page) {
  pagePool.push(page);
}

// ===============================
// Resolve short link → full link
// ===============================
async function resolveShortLink(page, url) {
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 20000,
  });

  // đợi URL đổi khỏi maps.app.goo.gl
  await page.waitForFunction(
    () => !location.href.includes("maps.app.goo.gl"),
    { timeout: 15000 }
  ).catch(() => {});

  return page.url();
}

// ===============================
// Extract lat/lon
// ===============================
async function extractGoogleMaps(url) {
  const page = await getPage();

  try {
    // Resolve short link
    await resolveShortLink(page, url);

    // Đợi Google Maps load và URL ổn định
    await page.waitForFunction(
      () => location.href.includes("@"),
      { timeout: 15000 }
    ).catch(() => {});

    const currentUrl = page.url();

    let lat = null;
    let lon = null;

    // Parse từ URL hiện tại (không dùng finalUrl nữa)
    const match = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      lat = parseFloat(match[1]);
      lon = parseFloat(match[2]);
    }

    if (!lat || !lon) {
      const match2 = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (match2) {
        lat = parseFloat(match2[1]);
        lon = parseFloat(match2[2]);
      }
    }

    // Đợi tên xuất hiện (selector chuẩn Google Maps desktop)
    await page.waitForSelector("h1.DUwDvf", { timeout: 15000 });

    const name = await page.$eval(
      "h1.DUwDvf",
      el => el.textContent.trim()
    );

    return {
      name,
      latitude: lat,
      longitude: lon,
      final_url: currentUrl,
    };

  } finally {
    releasePage(page);
  }
}


// ===============================
// API
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
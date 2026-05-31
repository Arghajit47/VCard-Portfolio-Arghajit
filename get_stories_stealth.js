// Import the "extra" version of puppeteer
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

// Apply the stealth plugin to hide automation flags
puppeteer.use(StealthPlugin());

const USERNAME = "@arghajitsingha47";

// Helper to pause execution
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

/**
 * Normalise a raw Medium date string into "DD-MM-YYYY".
 *
 * Handled formats:
 *  1. "Oct 12, 2024"  → full date  → DD-MM-YYYY
 *  2. "Oct 12"        → no year    → DD-MM-YYYY  (current year)
 *  3. "Xd ago"        → X days ago → DD-MM-YYYY
 *  4. "Xmins ago" / "Xmin ago" / "Xh ago" / "just now"
 *                     → today      → DD-MM-YYYY
 */
function normaliseDate(raw) {
  if (!raw) return "";

  // Strip leading action words Medium sometimes prepends, e.g. "Published 5d ago"
  const text = raw.trim().replace(/^(Published|Updated|Posted)\s+/i, "");
  const now  = new Date();

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) =>
    `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

  // Rule 3 – "Xd ago"  (e.g. "3d ago")
  const daysAgoMatch = text.match(/^(\d+)\s*d\s+ago$/i);
  if (daysAgoMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
    return fmt(d);
  }

  // Rule 4 – "Xmins ago" / "Xmin ago" / "Xh ago" / "just now" → today
  if (/(\d+\s*(min|mins|minute|minutes|h|hr|hrs|hour|hours)\s+ago|just now)/i.test(text)) {
    return fmt(now);
  }

  // Rule 1 – "Oct 12, 2024"  (month day, year)
  const fullDateMatch = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (fullDateMatch) {
    const parsed = new Date(`${fullDateMatch[1]} ${fullDateMatch[2]}, ${fullDateMatch[3]}`);
    if (!isNaN(parsed)) return fmt(parsed);
  }

  // Rule 2 – "Oct 12"  (month day, no year → current year)
  const shortDateMatch = text.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (shortDateMatch) {
    const parsed = new Date(`${shortDateMatch[1]} ${shortDateMatch[2]}, ${now.getFullYear()}`);
    if (!isNaN(parsed)) return fmt(parsed);
  }

  // Fallback – return the raw string unchanged
  return text;
}

(async () => {
  console.log("🥷 Launching Stealth Browser...");
  const browser = await puppeteer.launch({
    // If running in CI (GitHub Actions), use headless: "new". Otherwise allow false.
    headless: process.env.CI ? "new" : false,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--disable-notifications",
      // Crucial for running Puppeteer in Docker/CI environments:
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage();

  console.log(`navigating to https://medium.com/${USERNAME}`);
  await page.goto(`https://medium.com/${USERNAME}`, {
    waitUntil: "networkidle2",
  });

  // --- HUMAN HANDOVER LOGIC ---
  try {
    console.log("👀 Checking for stories...");
    await page.waitForSelector('a[data-action="show-post-card"], article, div[role="article"]', { timeout: 5000 });
  } catch (e) {
    console.log("⚠️  BOT DETECTION TRIGGERED or Page Loading Slow ⚠️");
    console.log("👉 Please switch to the browser window.");
    console.log("👉 SOLVE THE CAPTCHA / VERIFY YOU ARE HUMAN.");
    console.log("⏳ Script is waiting for your profile to load...");
    await page.waitForSelector('a[data-action="show-post-card"], article, div[role="article"]', { timeout: 0 });
    console.log("✅ Verification passed! Resuming scraper...");
  }

  const uniqueStories = new Map();
  console.log("📜 Starting Scroll & Scrape process...");

  let previousHeight = 0;
  let noChangeCount  = 0;

  while (true) {
    const newStories = await page.evaluate(() => {
      const data     = [];
      // Updated selectors for current Medium structure
      const articles = document.querySelectorAll(
        'a[data-action="show-post-card"], article, div[role="article"], div.js-postPreview'
      );

      articles.forEach((article) => {
        // Find the actual container - sometimes the link itself is the container
        const container = article.tagName === 'A' ? article : article;
        
        // Title selectors - try multiple approaches
        let titleEl = container.querySelector("h2, h3, [data-testid='title']");
        if (!titleEl) {
          const headings = container.querySelectorAll('h1, h2, h3, h4');
          if (headings.length > 0) titleEl = headings[0];
        }

        // Link selectors - prioritize direct href on the container or find anchor
        let linkEl = container.tagName === 'A' ? container : container.querySelector('a[href*="/@"]');
        if (!linkEl) {
          const anchors = container.querySelectorAll('a');
          for (const a of anchors) {
            if (a.href && a.href.includes('/')) {
              linkEl = a;
              break;
            }
          }
        }

        // Image selectors
        const imgEl = container.querySelector("img[alt], img[src*='miro'], img[src*='images']");

        // Date selectors - updated for current Medium markup
        const dateSelectors = [
          "time",                          // semantic <time> element
          '[data-testid="storyPublishDate"]',
          'span[aria-label*="ago"]',        // relative time spans
          'span[data-tooltip]',             // tooltips with dates
          'span.vy, span.vw',               // Medium's common date span classes
        ];

        let rawDate = "";
        for (const sel of dateSelectors) {
          const el = container.querySelector(sel);
          if (el) {
            // Prefer the datetime attribute on <time>, fall back to innerText
            rawDate = el.getAttribute("datetime") || el.getAttribute("title") || el.innerText || "";
            if (rawDate.trim()) break;
          }
        }

        // Fallback: scan all text nodes for date-like patterns
        if (!rawDate.trim()) {
          const allText = container.innerText || "";
          // Look for date patterns in the text
          const datePatterns = [
            /\b[A-Za-z]{3}\s+\d{1,2},\s*\d{4}\b/,  // "Oct 12, 2024"
            /\b[A-Za-z]{3}\s+\d{1,2}\b/,            // "Oct 12"
            /\b\d+\s*d\s+ago\b/i,                   // "3d ago"
            /\b\d+\s*min(?:ute)?s?\s+ago\b/i,       // "5mins ago"
            /\b\d+\s*h(?:our)?\s+ago\b/i,           // "2h ago"
            /\bjust now\b/i,                        // "just now"
          ];
          
          for (const pattern of datePatterns) {
            const match = allText.match(pattern);
            if (match) {
              rawDate = match[0];
              break;
            }
          }
        }

        if (titleEl && linkEl) {
          let link = linkEl.href ? linkEl.href.split("?")[0] : "";
          let img  = imgEl ? imgEl.src : "No Image";

          if (link && titleEl.innerText) {
            data.push({
              title:   titleEl.innerText.trim(),
              url:     link,
              image:   img,
              rawDate: rawDate.trim(),
            });
          }
        }
      });
      return data;
    });

    let addedCount = 0;
    newStories.forEach((story) => {
      if (!uniqueStories.has(story.url)) {
        // Normalise the date on the Node.js side (has access to Date)
        story.date = normaliseDate(story.rawDate);
        delete story.rawDate; // keep the output clean
        uniqueStories.set(story.url, story);
        addedCount++;
      }
    });

    if (addedCount > 0)
      console.log(
        `   Found ${addedCount} new stories (Total: ${uniqueStories.size})`
      );

    previousHeight = await page.evaluate("document.body.scrollHeight");
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await delay(3000);

    const newHeight = await page.evaluate("document.body.scrollHeight");
    if (newHeight === previousHeight) {
      noChangeCount++;
      console.log("   ...Waiting for more content...");
      if (noChangeCount >= 3) {
        console.log("✅ Reached bottom of page.");
        break;
      }
    } else {
      noChangeCount = 0;
    }
  }

  // --- SAVE ---
  const results = Array.from(uniqueStories.values());
  if (results.length > 0) {
    const jsContent = `const mediumStoriesData = ${JSON.stringify(
      results,
      null,
      2
    )};`;

    fs.writeFileSync("blog_data.js", jsContent);

    console.log(`\n🎉 SUCCESS: Extracted ${results.length} unique stories.`);
    console.log(`📂 Saved to blog_data.js (Ready for direct HTML import)`);

    // Quick summary of date coverage
    const withDate    = results.filter((r) => r.date).length;
    const withoutDate = results.length - withDate;
    console.log(`📅 Date coverage: ${withDate} with date, ${withoutDate} without.`);
  } else {
    console.log("❌ No stories found.");
  }

  await browser.close();
})();

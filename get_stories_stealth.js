// Import the "extra" version of puppeteer
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

// Apply the stealth plugin to hide automation flags
puppeteer.use(StealthPlugin());

const USERNAME = "@arghajitsingha47";

// Helper to pause execution
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

(async () => {
  console.log("🥷 Launching Stealth Browser...");
  const browser = await puppeteer.launch({
    headless: true, // Must be false to solve Captcha
    defaultViewport: null,
    args: ["--start-maximized", "--disable-notifications"],
  });

  const page = await browser.newPage();

  console.log(`navigating to https://medium.com/${USERNAME}/...`);
  await page.goto(`https://medium.com/${USERNAME}/`, {
    waitUntil: "networkidle2",
  });

  // --- HUMAN HANDOVER LOGIC ---
  try {
    console.log("👀 Checking for stories...");
    await page.waitForSelector('article, div[role="link"]', { timeout: 5000 });
  } catch (e) {
    console.log("⚠️  BOT DETECTION TRIGGERED or Page Loading Slow ⚠️");
    console.log("👉 Please switch to the browser window.");
    console.log("👉 SOLVE THE CAPTCHA / VERIFY YOU ARE HUMAN.");
    console.log("⏳ Script is waiting for your profile to load...");
    await page.waitForSelector('article, div[role="link"]', { timeout: 0 });
    console.log("✅ Verification passed! Resuming scraper...");
  }

  const uniqueStories = new Map();
  console.log("📜 Starting Scroll & Scrape process...");

  let previousHeight = 0;
  let noChangeCount = 0;

  while (true) {
    const newStories = await page.evaluate(() => {
      const data = [];
      const articles = document.querySelectorAll(
        'div[role="link"], article, [data-testid="post-preview"]'
      );

      articles.forEach((article) => {
        const titleEl = article.querySelector("h2");
        const linkEl = article.querySelector('a[href*="/"]');
        const imgEl = article.querySelector("img");

        if (titleEl && linkEl) {
          let link = linkEl.href.split("?")[0];
          let img = imgEl ? imgEl.src : "No Image";

          data.push({
            title: titleEl.innerText,
            url: link,
            image: img,
          });
        }
      });
      return data;
    });

    let addedCount = 0;
    newStories.forEach((story) => {
      if (!uniqueStories.has(story.url)) {
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

  // --- MODIFIED SAVE SECTION ---
  const results = Array.from(uniqueStories.values());
  if (results.length > 0) {
    // Construct valid JavaScript code
    const jsContent = `const mediumStoriesData = ${JSON.stringify(
      results,
      null,
      2
    )};`;

    // Write to .js file instead of .json
    fs.writeFileSync("blog_data.js", jsContent);

    console.log(`\n🎉 SUCCESS: Extracted ${results.length} unique stories.`);
    console.log(`📂 Saved to blog_data.js (Ready for direct HTML import)`);
  } else {
    console.log("❌ No stories found.");
  }

  await browser.close();
})();

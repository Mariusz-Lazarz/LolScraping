const puppeteer = require("puppeteer");
const axios = require("axios");

const scrapeScript = async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new" });
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    await page.goto("https://lolesports.com/schedule?leagues=lec", {
      waitUntil: "networkidle0",
    });

    await page.waitForSelector(".EventDate, .EventMatch", { timeout: 5000 });

    const data = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(".EventDate, .EventMatch")
      );
      const results = [];
      let currentDate = null;

      nodes.forEach((node) => {
        if (node.matches(".EventDate")) {
          currentDate = node.textContent;
        } else if (currentDate && node.matches(".EventMatch")) {
          const team1 =
            node.querySelector(".team1 span.name")?.textContent || "N/A";
          const team2 =
            node.querySelector(".team2 span.name")?.textContent || "N/A";
          const score = node.querySelector(".score")?.textContent || "N/A";

          const existingDateObj = results.find(
            (result) => result.date === currentDate
          );
          if (existingDateObj) {
            existingDateObj.matches.push({ team1, team2, score });
          } else {
            results.push({
              date: currentDate,
              matches: [{ team1, team2, score }],
            });
          }
        }
      });
      return results;
    });

    if (data.length === 0) {
      throw new Error("No data found on the page");
    }
    const response = await axios.put(
      "https://react-ffef8-default-rtdb.europe-west1.firebasedatabase.app/matches.json",
      data
    );
    if (response.status !== 200) {
      throw new Error("Failed to update the database");
    }
    console.log("Data sent to Firebase successfully");
    return data;
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

if (require.main === module) {
  scrapeScript().catch((error) => console.error(error));
}

module.exports = scrapeScript;

const puppeteer = require("puppeteer");
const axios = require("axios");

const scrapeScript = async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto("https://lolesports.com/schedule?leagues=lec");
  await page.waitForSelector(".EventDate, .EventMatch");

  const data = await page.evaluate(() => {
    try {
      const nodes = Array.from(
        document.querySelectorAll(".EventDate, .EventMatch")
      );
      const results = [];

      let currentDate = null;

      nodes.forEach((node) => {
        if (node.matches(".EventDate")) {
          if (node.textContent.startsWith("Yesterday")) {
            const dateObj = new Date();
            dateObj.setDate(dateObj.getDate() - 1);
            const weekday = dateObj.toLocaleString("default", {
              weekday: "long",
            });
            const month = dateObj.toLocaleString("default", { month: "long" });
            const day = dateObj.getDate();
            currentDate = `${weekday}-${day} ${month}`;
          } else {
            currentDate = node.textContent;
          }
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
    } catch (error) {
      console.error("Error during page evaluation:", error);
      return [];
    }
  });

  await browser.close();
  return data;
};

const init = async () => {
  try {
    const data = await scrapeScript();
    const response = await axios.put(
      "https://react-ffef8-default-rtdb.europe-west1.firebasedatabase.app/matches.json",
      data
    );
  } catch (error) {
    console.error(error);
  }
};

init();

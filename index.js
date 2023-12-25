const chromium = require("chrome-aws-lambda");
const axios = require("axios");

const scrapeData = async (page) => {
  return page.evaluate(() => {
    const matches = [];
    const eventDateElements = document.querySelectorAll(
      ".EventDate, .EventMatch"
    );

    let currentDate = null;

    eventDateElements.forEach((element) => {
      if (element.classList.contains("EventDate")) {
        const dateText = element.textContent;
        let date = new Date();

        if (dateText.includes("Yesterday")) {
          date.setDate(date.getDate() - 1);
        } else if (dateText.includes("Tomorrow")) {
          date.setDate(date.getDate() + 1);
        } else if (!dateText.includes("Today")) {
          currentDate = dateText;
        } else {
          currentDate = date.toLocaleDateString("en-GB", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
        }

        matches.push({ date: currentDate, matches: [] });
      } else if (currentDate && !element.querySelector(".live")) {
        const matchElement = element.querySelector(".EventMatch .teams");
        if (!matchElement) return;

        const matchClasses = matchElement.classList;
        const hasWinner =
          matchClasses.contains("winner-team1") ||
          matchClasses.contains("winner-team2");

        const team1 =
          matchElement.querySelector(".team.team1 h2 .name")?.textContent ||
          "N/A";
        const iconTeam1 =
          matchElement.querySelector(".team.team1 img")?.src || "No IMG";
        const score1 =
          matchElement.querySelector(".score .scoreTeam1")?.textContent ||
          "N/A";

        const team2 =
          matchElement.querySelector(".team.team2 h2 .name")?.textContent ||
          "N/A";
        const iconTeam2 =
          matchElement.querySelector(".team.team2 img")?.src || "No IMG";
        const score2 =
          matchElement.querySelector(".score .scoreTeam2")?.textContent ||
          "N/A";

        const winner = hasWinner
          ? matchClasses.contains("winner-team2")
            ? team2
            : team1
          : "";

        matches[matches.length - 1].matches.push({
          Winner: winner,
          Team1: team1,
          Icon1: iconTeam1,
          Score1: score1,
          Score2: score2,
          Team2: team2,
          Icon2: iconTeam2,
        });
      }
    });

    return matches;
  });
};

const sendDataToFirebase = async (data) => {
  const response = await axios.put(
    "https://react-ffef8-default-rtdb.europe-west1.firebasedatabase.app/matches.json",
    data
  );

  if (response.status !== 200) {
    throw new Error("Failed to update the database");
  }
};

exports.handler = async (event, context, callback) => {
  let browser = null;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.goto("https://lolesports.com/schedule?leagues=lec");
    await page.waitForSelector(".EventDate");
    const data = await scrapeData(page);
    await sendDataToFirebase(data);

    return callback(null, {
      message: "Data scraped and sent to Firebase successfully",
      data,
    });
  } catch (error) {
    return callback(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};

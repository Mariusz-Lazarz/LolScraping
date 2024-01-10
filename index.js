const chromium = require("chrome-aws-lambda");
const moment = require("moment");
const { db } = require("./firebase");
const { ref, set, get } = require("firebase/database");

const scrapeData = async (page) => {
  return page.evaluate(() => {
    const matches = [];
    const eventDateElements = document.querySelectorAll(
      ".EventDate, .EventMatch"
    );

    let currentDate = null;

    eventDateElements.forEach((element) => {
      if (element.classList.contains("EventDate")) {
        currentDate = element.textContent.trim();
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

        const league =
          element.querySelector(".event .league .name")?.textContent || "N/A";
        const format =
          element.querySelector(".event .league .strategy")?.textContent ||
          "N/A";

        const winner = hasWinner
          ? matchClasses.contains("winner-team2")
            ? team2
            : team1
          : "";

        const parts = currentDate.split(/[-–]/);
        if (parts.length > 1) {
          const dayMonth = parts[1].trim() + " " + new Date().getFullYear();
          const hour =
            element.querySelector(".event .EventTime .time .hour")
              ?.textContent || "00";
          const minute =
            element.querySelector(".event .EventTime .time .minute")
              ?.textContent || "00";
          const fullDateStr = dayMonth + " " + hour + ":" + minute;

          matches.push({
            date: fullDateStr,
            winner: winner,
            team1: team1,
            iconTeam1: iconTeam1,
            score1: score1,
            team2: team2,
            iconTeam2: iconTeam2,
            score2: score2,
            league: league,
            format: format,
            timestamp: new Date(),
          });
        }
      }
    });
    return matches;
  });
};

const saveDataToFirebase = async (data) => {
  for (const match of data) {
    try {
      // Parse the date using the German format with a dot
      const parsedDate = moment(match.date, "DD. MMMM YYYY HH:mm", "de");

      // Convert the parsed date to UTC and format it as an ISO 8601 string
      const formattedDate = parsedDate.utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
      match.date = formattedDate; // This will now be in UTC+0 format
      match.timezone = "UTC"; // Indicate that the timezone is UTC

      const matchId =
        `${match.team1}-${match.team2}-${match.date}-${match.league}-${match.format}`
          .replace(/\s+/g, "-")
          .toLowerCase()
          .replace(/:/g, "-")
          .replace(/\./g, "");

      const matchRef = ref(db, `matches/${matchId}`);

      const matchSnapshot = await get(matchRef);
      if (!matchSnapshot.exists()) {
        await set(matchRef, match);
        console.log("Match saved successfully with ID:", matchId);
      } else {
        console.log("Match already exists, skipping...", matchId);
      }
    } catch (error) {
      console.log("Error checking or saving match.", error);
    }
  }
};

exports.handler = async (event, context) => {
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
    // await page.setExtraHTTPHeaders({
    //   "Accept-Language": "en-US", // Set the language to English
    // });
    await page.goto("https://lolesports.com/schedule?leagues=lec");
    await page.waitForSelector(".EventDate");
    const data = await scrapeData(page);

    // Make sure saveDataToFirebase resolves before proceeding
    await saveDataToFirebase(data);

    // Return the response directly without using callback
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Data scraped and sent to Firebase successfully",
      }),
    };
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};

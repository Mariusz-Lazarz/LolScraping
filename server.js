const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const scrapeScript = require("./index");
const axios = require("axios");

app.get("/", async (req, res) => {
    try {
      const data = await scrapeScript();
  
      const response = await axios.put(
        "https://react-ffef8-default-rtdb.europe-west1.firebasedatabase.app/matches.json",
        data
      );
  
      if (response.status !== 200) {
        throw new Error("Failed to update the database");
      }
  
      res.json({ message: "Data updated successfully", data });
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});

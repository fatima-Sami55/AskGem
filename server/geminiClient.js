const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ FATAL: GEMINI_API_KEY is not defined in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Use a model that is available in the user's account
const MODEL_NAME = "gemini-2.5-flash";

const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  generationConfig: {
    responseMimeType: "application/json", // Enforce JSON output
  },
});

/**
 * Generates content with retry logic
 * @param {string} prompt
 * @returns {Promise<any>} Parsed JSON response
 */
const generateContent = async (prompt, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn(`JSON Parse failed attempt ${i + 1}:`, text.substring(0, 100) + "...");
        throw new Error("Invalid JSON response from Gemini");
      }
    } catch (error) {
      console.error(`Gemini API Error (Attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
      await new Promise((res) => setTimeout(res, 1000 * (i + 1))); // Exponential backoff-ish
    }
  }
};

module.exports = { generateContent };

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// We use the flash model because it is exceptionally fast, perfect for a real-time pipeline
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SYSTEM_PROMPT = `
You are the parsing engine for a personal productivity dashboard. 
Your job is to read a user's text message and categorize it as a 'task', 'habit', or 'project'.

RULES:
1. You must ONLY respond with a valid JSON object. No markdown, no explanations, no greetings.
2. The JSON must exactly match one of the following structures:

For Tasks:
{ "type": "task", "content": "The extracted task description" }

For Habits:
{ "type": "habit", "name": "The extracted habit name" }

For Projects:
{ "type": "project", "name": "The extracted project name" }

EXAMPLES:
User: "I need to buy milk tomorrow"
Output: { "type": "task", "content": "Buy milk tomorrow" }

User: "Start a new project for rebuilding my motorcycle"
Output: { "type": "project", "name": "Rebuild motorcycle" }

User: "Read 10 pages"
Output: { "type": "habit", "name": "Read 10 pages" }
`;

async function classifyMessage(rawText) {
    try {
        console.log(`[Classifier] Analyzing message: "${rawText}"...`);
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: rawText }] }],
            systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] }
        });

        let rawResponse = result.response.text().trim();

        // Safety cleanup: Sometimes AI adds markdown code blocks (e.g., \`\`\`json ... \`\`\`). We strip them.
        if (rawResponse.startsWith("```json")) {
            rawResponse = rawResponse.replace(/```json\n?/, '').replace(/```$/, '').trim();
        }

        // Convert the string into a real JavaScript object
        const parsedData = JSON.parse(rawResponse);
        console.log(`[Classifier] Successfully extracted intent:`, parsedData);
        
        return parsedData;

    } catch (error) {
        console.error("[Classifier Error] Failed to parse message via Gemini:", error.message);
        // Fallback: If AI fails, log it as a raw task so the thought isn't lost
        return { type: "task", content: rawText };
    }
}

// --- STANDALONE TEST RUNNER ---
// If you run 'node classifier.js' directly in the terminal, it will execute this block to test the AI.
if (require.main === module) {
    (async () => {
        console.log("--- Testing Gemini Classifier Standalone ---");
        await classifyMessage("I need to finish the database assignment for university.");
        await classifyMessage("Meditate for 10 minutes");
        await classifyMessage("Let's build a new Chrome extension");
    })();
}

// Export the function so app.js can use it later
module.exports = { classifyMessage };
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();



// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);




// We use the flash model because it is exceptionally fast, perfect for a real-time pipeline
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });




const SYSTEM_PROMPT = `
You are the parsing engine for a personal productivity dashboard. 
Read the user's message and categorize it into a strict JSON format.

RULES:
1. ONLY respond with valid JSON.
2. Determine if the user is CREATING a new item, or COMPLETING an existing task or habit.

JSON SCHEMA:
For Creating a Task:
{ "type": "task", "action": "create", "content": "The extracted task description" }

For Completing/Marking a Task Done:
{ "type": "task", "action": "complete", "target": "The core keywords of the task to complete" }

For Creating a Habit:
{ "type": "habit", "action": "create", "name": "The habit name" }

For Completing a Habit (e.g., "I read 10 pages today"):
{ "type": "habit", "action": "complete", "target": "The core keywords of the habit" }

For Projects (Always create):
{ "type": "project", "action": "create", "name": "The project name" }

EXAMPLES:
User: "I need to buy milk tomorrow"
Output: { "type": "task", "action": "create", "content": "Buy milk tomorrow" }

User: "I bought the milk" OR "Mark milk as done"
Output: { "type": "task", "action": "complete", "target": "milk" }

User: "Start a habit to read 10 pages"
Output: { "type": "habit", "action": "create", "name": "Read 10 pages" }

User: "I read 10 pages today"
Output: { "type": "habit", "action": "complete", "target": "read 10 pages" }

User: "Finished the motorcycle battery"
Output: { "type": "task", "action": "complete", "target": "motorcycle battery" }
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
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();



// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);




// We use the flash model because it is exceptionally fast, perfect for a real-time pipeline
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });




const SYSTEM_PROMPT = `
You are the primary cognitive routing engine for Cortex, a personal operating system running a hybrid GTD + PARA productivity framework.
Your task is to parse raw brain dumps into a deterministic, structured JSON schema.

TRIAGING TREE CRITERIA:
1. PROJECT (.p / "create"): Multi-step milestones or active technical operations requiring multiple distinct actions to hit a completion state.
2. TASK (.t / "create"): A discrete, single-step execution item.
3. HABIT (.hb / "create"): A recurring operational standard practiced daily or on a set rhythm to build streaks.
4. ACTION LOGICS (.tc / .hc / "complete"): Sentences indicating an event already happened or a target is finished.

JSON SCHEMAS:
- Task Triage: { "type": "task", "action": "create" | "complete", "content": "Clean action description", "target": "matching keywords if completing" }
- Habit Triage: { "type": "habit", "action": "create" | "complete", "name": "Standard habit title", "target": "matching keywords if completing" }
- Project Triage: { "type": "project", "action": "create", "name": "Project name" }

EXECUTION GUIDELINES:
- Strip out immediate conversational filler ("hey", "need to remember to", "today").
- Isolate the objective essence. If the user states a task that naturally falls into an active project area, keep the type as 'task' but extract the precise content.
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
const { startWhatsAppListener, registerPipeline } = require('./whatsapp');
const { classifyMessage } = require('./classifier');
const db = require('./database');



/**
 * The Master Ingestion Pipeline
 * This function fires every time a message hits your WhatsApp group.
 */
/**
 * The Master Ingestion Pipeline (CLI + AI Hybrid)
 */


async function processMessagePipeline(rawText) {
    console.log(`\n=========================================`);
    console.log(`[Pipeline] 📥 New raw message received: "${rawText}"`);

    const text = rawText.trim();



    // ---------------------------------------------------------
    // THE CORTEX CLI ROUTER (Fast, Deterministic, No AI)
    // ---------------------------------------------------------
    if (text.startsWith('.')) {
        // Split the text at the first space. 
        // Example: ".tc Buy milk" -> command: ".tc", payload: "Buy milk"
        const firstSpaceIndex = text.indexOf(' ');
        const command = firstSpaceIndex === -1 ? text : text.substring(0, firstSpaceIndex).toLowerCase();
        const payload = firstSpaceIndex === -1 ? '' : text.substring(firstSpaceIndex + 1).trim();

        try {
            if (command === '.t') {
                const result = db.insertTask(payload);
                console.log(`[CLI] ✅ Task created: ${result.content}`);
                
            } else if (command === '.tc') {
                const changes = db.completeTask(payload);
                console.log(changes > 0 ? `[CLI] 🎯 Task marked DONE: "${payload}"` : `[CLI] ⚠️ Task not found: "${payload}"`);
                
            } else if (command === '.hb') {
                const result = db.insertHabit(payload);
                console.log(`[CLI] ✅ Habit created: ${result.name}`);
                
            } else if (command === '.hc') {
                const changes = db.completeHabit(payload);
                console.log(changes > 0 ? `[CLI] 🔥 Habit updated for today: "${payload}"` : `[CLI] ⚠️ Habit already done/not found: "${payload}"`);
                
            } else if (command === '.p') {
                const result = db.insertProject(payload);
                console.log(`[CLI] ✅ Project created: ${result.name}`);
                
            } else {
                console.log(`[CLI] ⚠️ Unknown command: ${command}`);
            }
        } catch (dbError) {
            console.error(`[CLI Error] ❌ Database write failed:`, dbError.message);
        }
        console.log(`=========================================\n`);
        return; // Stop execution here so it doesn't go to Gemini



    }




    
    // ---------------------------------------------------------
    // THE AI FALLBACK (For unstructured brain dumps)
    // ---------------------------------------------------------
    console.log(`[Pipeline] No CLI tag detected. Routing to Gemini AI...`);
    const parsedData = await classifyMessage(rawText);
    
    if (!parsedData || !parsedData.type) {
        console.error(`[Pipeline Error] ❌ AI failed to return structured data.`);
        return;
    }

    try {
        if (parsedData.type === 'task') {
            if (parsedData.action === 'complete') {
                db.completeTask(parsedData.target);
                console.log(`[AI Route] 🎯 Task marked DONE: "${parsedData.target}"`);
            } else {
                db.insertTask(parsedData.content);
                console.log(`[AI Route] ✅ Task created: "${parsedData.content}"`);
            }
        } else if (parsedData.type === 'habit') {
             if (parsedData.action === 'complete') {
                db.completeHabit(parsedData.target);
                console.log(`[AI Route] 🔥 Habit updated: "${parsedData.target}"`);
            } else {
                db.insertHabit(parsedData.name);
                console.log(`[AI Route] ✅ Habit created: "${parsedData.name}"`);
            }
        } else if (parsedData.type === 'project') {
            db.insertProject(parsedData.name);
            console.log(`[AI Route] ✅ Project created: "${parsedData.name}"`);
        }
    } catch (dbError) {
        console.error(`[Pipeline Error] ❌ Database write failed:`, dbError.message);
    }
    console.log(`=========================================\n`);
}






// ---------------------------------------------------------
// BOOT SEQUENCE
// ---------------------------------------------------------

console.log("Starting Cortex Master Controller...");



// 1. Plug the pipeline logic into the WhatsApp listener
registerPipeline(processMessagePipeline);





// 2. Boot up the WhatsApp connection
startWhatsAppListener().catch(err => {
    console.error("--- CRITICAL TOP-LEVEL RUNTIME ERROR ---");
    console.error(err);
});
const { startWhatsAppListener, registerPipeline } = require('./whatsapp');
const { classifyMessage } = require('./classifier');
const db = require('./database');

/**
 * The Master Ingestion Pipeline
 * This function fires every time a message hits your WhatsApp group.
 */
async function processMessagePipeline(rawText) {
    console.log(`\n=========================================`);
    console.log(`[Pipeline] 📥 New raw message received: "${rawText}"`);
    
    // 1. Send the raw text to the Gemini AI Brain
    const parsedData = await classifyMessage(rawText);
    
    if (!parsedData || !parsedData.type) {
        console.error(`[Pipeline Error] ❌ AI failed to return structured data.`);
        return;
    }

    // 2. Route the structured data to the correct local database table
    try {
        let result;

        if (parsedData.type === 'task') {
            result = db.insertTask(parsedData.content);
            console.log(`[Pipeline] ✅ Task saved to DB (ID: ${result.id}) -> ${result.content}`);
            
        } else if (parsedData.type === 'habit') {
            result = db.insertHabit(parsedData.name);
            console.log(`[Pipeline] ✅ Habit saved to DB (ID: ${result.id}) -> ${result.name}`);
            
        } else if (parsedData.type === 'project') {
            result = db.insertProject(parsedData.name);
            console.log(`[Pipeline] ✅ Project saved to DB (ID: ${result.id}) -> ${result.name}`);
            
        } else {
            console.log(`[Pipeline] ⚠️ Unknown type received:`, parsedData);
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
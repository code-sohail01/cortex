const { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Placeholder for the Phase 2 Processing Module link
const processIncomingMessage = (rawText) => {
    console.log(`[Pipeline Link] Passing raw text to classifier: "${rawText}"`);
};

async function startWhatsAppListener() {
    // 1. Setup persistent session authentication storage
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    // 2. Initialize Baileys Socket with silent logging to keep terminal clean
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Turned off to prevent terminal rendering clashes
        logger: pino({ level: 'silent' })
    });

    // 3. Listen for changes in the connection state
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Manually catch the QR string and draw a compact code to the terminal screen
        if (qr) {
            console.log('\n--- SCAN THE QR CODE BELOW WITH WHATSAPP TO LOG IN ---');
            qrcode.generate(qr, { small: true });
            console.log('-----------------------------------------------------\n');
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`[Connection Status] Closed. Reason Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                console.log("[Connection Status] Attempting to re-establish connection stream...");
                startWhatsAppListener(); // Re-enter the boot loop
            }
        } else if (connection === 'open') {
            console.log('\n=========================================');
            console.log('SUCCESS: Cortex is officially connected to WhatsApp!');
            console.log('=========================================\n');
        }
    });

    // 4. Save authentication credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

    // 5. Ingestion Pipeline: Listen for incoming/outgoing messages
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                // Ensure the message has an actual body message object
                if (!msg.message) continue;

                // Extract metadata
                const remoteJid = msg.key.remoteJid;
                const fromMe = msg.key.fromMe;

                // Safely parse text across multiple possible WhatsApp message schemas
                const textContent = msg.message.conversation || 
                                    msg.message.extendedTextMessage?.text;

                if (!textContent) continue;

                const targetGroupJid = process.env.WHATSAPP_GROUP_JID;

                // DIAGNOSTIC GATE: If no group ID is locked into .env yet, print everything to help find it
                if (!targetGroupJid || targetGroupJid === 'replace_this_with_your_actual_group_id_later') {
                    console.log(`\n[Diagnostic] Message Detected!`);
                    console.log(`-> From Room JID: ${remoteJid}`);
                    console.log(`-> Sent by you?  ${fromMe}`);
                    console.log(`-> Content:      "${textContent}"`);
                    console.log('--------------------------------------------------');
                    continue;
                }

                // PRODUCTION GATE: Only pass text along if it matches your locked-in group
                if (remoteJid === targetGroupJid) {
                    console.log(`[Ingestion Core] Captured message (fromMe: ${fromMe}): "${textContent}"`);
                    processIncomingMessage(textContent);
                }
            }
        } catch (pipelineError) {
            console.error("\n[Pipeline Error] Error caught inside message loop:", pipelineError.message);
        }
    });
}

// Start execution and global crash protection
startWhatsAppListener().catch(err => {
    console.error("--- CRITICAL TOP-LEVEL RUNTIME ERROR ---");
    console.error(err);
});
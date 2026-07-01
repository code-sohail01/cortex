const { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
require('dotenv').config();

// We initialize a mock message processing handler for now.
// In Phase 2, this will link directly to classifier.js
const processIncomingMessage = (rawText) => {
    console.log(`[Pipeline Link] Passing raw text to classifier: "${rawText}"`);
};

async function startWhatsAppListener() {
    // 1. Setup persistent session authentication storage
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    // 2. Initialize Baileys Socket with silent logging
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) // Keeps your terminal clean
    });

    // 3. Listen for changes in the connection state (QR generation, login, disconnects)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('--- SCAN THE QR CODE BELOW WITH WHATSAPP TO LOG IN ---');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed due to: ${lastDisconnect?.error}. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                startWhatsAppListener(); // Re-establish connection loop
            }
        } else if (connection === 'open') {
            console.log('\n=========================================');
            console.log('SUCCESS: Cortex is officially connected to WhatsApp!');
            console.log('=========================================\n');
        }
    });

    // 4. Save authentication credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

    // 5. Ingestion Pipeline: Listen for incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            // Ensure the message has text content and isn't sent by the system
            if (!msg.message || msg.key.fromMe) continue;

            const remoteJid = msg.key.remoteJid;
            const textContent = msg.message.conversation || 
                                msg.message.extendedTextMessage?.text;

            if (!textContent) continue;

            // Target Group Verification Gate
            const targetGroupJid = process.env.WHATSAPP_GROUP_JID;

            if (!targetGroupJid || targetGroupJid === 'replace_this_with_your_actual_group_id_later') {
                // Diagnostic Helper Mode: If no JID is configured yet, print IDs of any message received
                console.log(`\n[Diagnostic] Incoming message from JID: ${remoteJid}`);
                console.log(`[Diagnostic] Message body: "${textContent}"`);
                console.log('Copy this JID paste it inside your .env file to lock your pipeline to this room.');
                continue;
            }

            // Strict Pipeline isolation check
            if (remoteJid === targetGroupJid) {
                console.log(`[Ingestion Core] Captured raw string from target group: "${textContent}"`);
                processIncomingMessage(textContent);
            }
        }
    });
}

// Start the module execution
startWhatsAppListener().catch(err => console.error("Critical error in WhatsApp execution stream:", err));
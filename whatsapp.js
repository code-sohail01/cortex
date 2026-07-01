const { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// --- GLOBAL MEMORY CACHE ---
// This safely stores processed IDs to prevent ghost duplicates
const processedMessageIds = new Set();
let pipelineCallback = null;

function registerPipeline(callbackFunction) {
    pipelineCallback = callbackFunction;
}

async function startWhatsAppListener() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    // Initialize the WhatsApp Socket (this creates "sock")
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, 
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

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
                setTimeout(startWhatsAppListener, 2000); 
            }
        } else if (connection === 'open') {
            console.log('\n=========================================');
            console.log('SUCCESS: Cortex is officially connected to WhatsApp!');
            console.log('=========================================\n');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 🚨 The Message Listener (Now safely inside the function where "sock" exists) 🚨
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message) continue;

                // DUPLICATE PREVENTION: Check if we have already seen this exact message ID
                const messageId = msg.key.id;
                if (processedMessageIds.has(messageId)) continue;
                
                // Add to memory cache so we don't process it again
                processedMessageIds.add(messageId);
                
                // Keep the cache from growing infinitely by clearing it every 1000 messages
                if (processedMessageIds.size > 1000) processedMessageIds.clear();

                const remoteJid = msg.key.remoteJid;
                const fromMe = msg.key.fromMe;
                const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

                if (!textContent) continue;

                const targetGroupJid = process.env.WHATSAPP_GROUP_JID;

                if (!targetGroupJid || targetGroupJid === 'replace_this_with_your_actual_group_id_later') {
                    console.log(`\n[Diagnostic] Message Detected! From: ${remoteJid} | Content: "${textContent}"`);
                    continue;
                }

                if (remoteJid === targetGroupJid) {
                    console.log(`[Ingestion Core] Captured message (fromMe: ${fromMe}): "${textContent}"`);
                    if (pipelineCallback) pipelineCallback(textContent);
                }
            }
        } catch (pipelineError) {
            console.error("\n[Pipeline Error] Error caught inside message loop:", pipelineError.message);
        }
    });
}

module.exports = { startWhatsAppListener, registerPipeline };
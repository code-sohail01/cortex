const { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Callback to send data to app.js
let pipelineCallback = null;

function registerPipeline(callbackFunction) {
    pipelineCallback = callbackFunction;
}

async function startWhatsAppListener() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, 
        logger: pino({ level: 'silent' })
    });

sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message) continue;

                const remoteJid = msg.key.remoteJid;
                const fromMe = msg.key.fromMe;
                const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

                if (!textContent) continue;

                // Strip any accidental spaces from the .env variable just in case
                const targetGroupJid = process.env.WHATSAPP_GROUP_JID ? process.env.WHATSAPP_GROUP_JID.trim() : undefined;

                // --- EXTREME DEBUGGING LOGS ---
                console.log(`\n=========================================`);
                console.log(`[DEBUG ALERT] WhatsApp sent a message to the script!`);
                console.log(`[1] Incoming JID:   "${remoteJid}"`);
                console.log(`[2] Your .env JID:  "${targetGroupJid}"`);
                console.log(`[3] Do they match?:  ${remoteJid === targetGroupJid}`);
                console.log(`[4] Text Content:   "${textContent}"`);
                console.log(`=========================================\n`);
                // ------------------------------

                if (remoteJid === targetGroupJid) {
                    console.log(`[Ingestion Core] Match confirmed. Sending to pipeline...`);
                    if (pipelineCallback) pipelineCallback(textContent);
                }
            }
        } catch (pipelineError) {
            console.error("\n[Pipeline Error] Error caught inside message loop:", pipelineError.message);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message) continue;

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
                    // Sends the text directly to the Gemini brain in app.js
                    if (pipelineCallback) pipelineCallback(textContent);
                }
            }
        } catch (pipelineError) {
            console.error("\n[Pipeline Error] Error caught inside message loop:", pipelineError.message);
        }
    });
}

module.exports = { startWhatsAppListener, registerPipeline };
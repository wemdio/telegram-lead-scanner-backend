/**
 * Converts a TDATA (tdesktop) folder to a GramJS session.
 * Based on https://github.com/danog/MadelineProto/blob/master/src/danog/MadelineProto/Conversion.php
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { BinaryReader } = require('telegram/extensions');
const { IGE } = require('telegram/crypto/IGE');
const { AuthKey } = require('telegram/crypto/AuthKey');
const { StringSession } = require('telegram/sessions');

function tdesktop_md5(data) {
    let result = '';
    const hash = crypto.createHash('md5').update(data).digest("hex");
    for (let i = 0; i < hash.length; i += 2) {
        result += hash[i + 1] + hash[i];
    }
    return result.toUpperCase();
}

function tdesktop_readBuffer(file) {
    let length = file.read(4).reverse().readInt32LE();
    return length > 0 ? file.read(length, false) : Buffer.alloc(0);
}

function sha1(buf) {
    return crypto.createHash('sha1').update(buf).digest();
}

/**
 * Old way of calculating aes keys
 */
function _calcKey(authKey, msgKey, client) {
    const x = client ? 0 : 8;
    const sha1_a = sha1(Buffer.concat([msgKey, authKey.slice(x, x + 32)]));
    const sha1_b = sha1(Buffer.concat([authKey.slice(32 + x, 32 + x + 16), msgKey, authKey.slice(48 + x, 48 + x + 16)]));
    const sha1_c = sha1(Buffer.concat([authKey.slice(64 + x, 64 + x + 32), msgKey]));
    const sha1_d = sha1(Buffer.concat([msgKey, authKey.slice(96 + x, 96 + x + 32)]));

    const aes_key = Buffer.concat([sha1_a.slice(0, 8), sha1_b.slice(8, 8 + 12), sha1_c.slice(4, 4 + 12)]);
    const aes_iv = Buffer.concat([sha1_a.slice(8, 8 + 12), sha1_b.slice(0, 8), sha1_c.slice(16, 16 + 4), sha1_d.slice(0, 8)]);

    return { aes_key, aes_iv };
}

/**
 * Convert TData folder to StringSession
 */
async function convertTDataToStringSession(tdataPath) {
    try {
        // Check if tdata folder exists
        let actualTDataPath = tdataPath;
        if (fs.existsSync(path.join(tdataPath, 'tdata'))) {
            actualTDataPath = path.join(tdataPath, 'tdata');
        }

        // Look for key_datas file
        const keyDatasPath = path.join(actualTDataPath, 'key_datas');
        if (!fs.existsSync(keyDatasPath)) {
            throw new Error('key_datas file not found in TData folder');
        }

        // Read key_datas file
        const keyDatasBuffer = fs.readFileSync(keyDatasPath);
        const reader = new BinaryReader(keyDatasBuffer);

        // Skip first 4 bytes (magic)
        reader.read(4);

        // Read auth key
        const authKeyBuffer = tdesktop_readBuffer(reader);
        if (authKeyBuffer.length === 0) {
            throw new Error('No auth key found in TData');
        }

        // Create AuthKey object
        const authKey = new AuthKey();
        authKey.setKey(authKeyBuffer);

        // Read DC ID (usually stored in settings or we can try to detect)
        let dcId = 2; // Default DC
        
        // Try to read settings file to get DC info
        const settingsPath = path.join(actualTDataPath, 'settings');
        if (fs.existsSync(settingsPath)) {
            try {
                const settingsBuffer = fs.readFileSync(settingsPath);
                const settingsReader = new BinaryReader(settingsBuffer);
                // Skip magic and try to find DC info
                // This is a simplified approach - actual parsing would be more complex
                dcId = 2; // Keep default for now
            } catch (e) {
                console.log('Could not parse settings file, using default DC');
            }
        }

        // Create StringSession
        const stringSession = new StringSession();
        stringSession.setDC(dcId, '149.154.167.51', 443); // Default DC2 server
        stringSession.setAuthKey(authKey);

        return stringSession.save();
    } catch (error) {
        console.error('Error converting TData to StringSession:', error);
        throw error;
    }
}

module.exports = {
    convertTDataToStringSession
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';

function generateJoinCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return code;
}

module.exports = generateJoinCode;
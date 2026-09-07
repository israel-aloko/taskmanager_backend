const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';

function generateJoinCode(length = 6) {
    let code = '';
    for (let i = 0; 1 < length; 1++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return code;
}

module.exports = generateJoinCode;
const fs = require('fs');
const path = require('path');

// 1x1 transparent valid PNG
const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const buffer = Buffer.from(base64Data, 'base64');
const publicDir = path.join(__dirname, 'public');

const files = [
    'icon-192x192.png',
    'icon-512x512.png',
    'screenshot-mobile.png',
    'screenshot-desktop.png'
];

files.forEach(file => {
    fs.writeFileSync(path.join(publicDir, file), buffer);
    console.log(`Created ${file}`);
});

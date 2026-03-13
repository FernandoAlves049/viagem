const https = require('https');
const fs = require('fs');
const path = require('path');

const files = [
    { url: 'https://placehold.co/192x192/0f172a/4ade80.png?text=RatOnet', name: 'icon-192x192.png' },
    { url: 'https://placehold.co/512x512/0f172a/4ade80.png?text=RatOnet', name: 'icon-512x512.png' },
    { url: 'https://placehold.co/1080x1920/0f172a/4ade80.png?text=Mobile+App', name: 'screenshot-mobile.png' },
    { url: 'https://placehold.co/1920x1080/0f172a/4ade80.png?text=Centro+de+Comando', name: 'screenshot-desktop.png' }
];

const publicDir = path.join(__dirname, 'public');

async function downloadImages() {
    for (const file of files) {
        const dest = path.join(publicDir, file.name);
        await new Promise((resolve, reject) => {
            console.log(`Downloading ${file.url}...`);
            https.get(file.url, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    https.get(response.headers.location, (res) => {
                        const fileStream = fs.createWriteStream(dest);
                        res.pipe(fileStream);
                        fileStream.on('finish', () => { fileStream.close(() => resolve()); });
                    });
                } else if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(dest);
                    response.pipe(fileStream);
                    fileStream.on('finish', () => { fileStream.close(() => resolve()); });
                } else {
                    reject(`Failed with status ${response.statusCode}`);
                }
            }).on('error', err => reject(err));
        });
        console.log(`Saved ${file.name}`);
    }
}

downloadImages().then(() => console.log('Done')).catch(err => console.error(err));

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, '../public/fonts');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
  {
    name: 'Outfit-Variable.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/outfit/Outfit%5Bwght%5D.ttf',
  },
  {
    name: 'SpaceMono-Regular.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Regular.ttf',
  },
  {
    name: 'SpaceMono-Bold.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Bold.ttf',
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const get = (link) => {
      https
        .get(link, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            get(response.headers.location);
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download ${link}: ${response.statusCode}`));
            return;
          }
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${path.basename(dest)}`);
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    };
    get(url);
  });
}

async function downloadAll() {
  try {
    for (const font of fonts) {
      await downloadFile(font.url, path.join(fontsDir, font.name));
    }
    console.log('All fonts downloaded successfully.');
  } catch (err) {
    console.error('Error downloading fonts:', err);
    process.exit(1);
  }
}

downloadAll();

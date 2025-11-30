import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicDir = path.join(__dirname, '../public/assets/music');
const oggDir = path.join(musicDir, 'ogg');
const outputFile = path.join(musicDir, 'tracks.json');

// Helper to format title from filename
function formatTitle(filename) {
  const name = path.parse(filename).name;
  return name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function generateTracklist() {
  try {
    if (!fs.existsSync(oggDir)) {
      console.error('OGG directory not found:', oggDir);
      return;
    }

    const files = fs.readdirSync(oggDir).filter((file) => file.endsWith('.ogg'));

    const tracks = files.map((file, index) => {
      const filename = path.parse(file).name;
      return {
        id: filename, // Use filename as ID
        title: formatTitle(filename),
        filename: filename,
      };
    });

    fs.writeFileSync(outputFile, JSON.stringify(tracks, null, 2));
    console.log(`Generated tracks.json with ${tracks.length} tracks.`);
    console.log('Tracks:', tracks.map((t) => t.title).join(', '));
  } catch (error) {
    console.error('Error generating tracklist:', error);
  }
}

generateTracklist();

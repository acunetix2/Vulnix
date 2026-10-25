const fs = require('fs');
const svg = fs.readFileSync('frontend/public/favicon.svg', 'utf8');

// Extract all paths except the first (which is the black circle #080813)
const paths = [];
const regex = /<path d="([^"]+)" fill="([^"]+)" transform="([^"]+)"\/>/g;
let m;
while ((m = regex.exec(svg)) !== null) {
  paths.push({ fill: m[2], transform: m[3], d: m[1] });
}

// Group into left wing and right wing
// Path 1 is the main left wing (translate(301.7917175292969,384.8528289794922))
// Let's print out the transforms and fills
console.log('Path 1 transform:', paths[1].transform);
console.log('Path 2 transform:', paths[2].transform);
console.log('Path 3 transform:', paths[3].transform);

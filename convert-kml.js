import fs from 'fs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

console.log('Reading KML file...');
const kmlFile = fs.readFileSync('../prgeol.kml', 'utf8');

console.log('Parsing XML...');
const kmlDom = new DOMParser().parseFromString(kmlFile, 'text/xml');

console.log('Converting to GeoJSON...');
const geojson = kml(kmlDom);

const palette = ['#1d3a2f', '#a0522d', '#d4a843', '#b8c4bc', '#f2ede4'];

geojson.features.forEach(feature => {
  const name = feature.properties.name || 'Unknown';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % palette.length;
  feature.properties.color = palette[colorIndex];
});

console.log('Writing GeoJSON...');
fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync('./public/prgeol.geojson', JSON.stringify(geojson));

console.log('Conversion complete!');

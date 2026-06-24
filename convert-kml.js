import fs from 'fs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

console.log('Reading KML file...');
const kmlFile = fs.readFileSync('../prgeol.kml', 'utf8');

console.log('Parsing XML...');
const kmlDom = new DOMParser().parseFromString(kmlFile, 'text/xml');

console.log('Converting to GeoJSON...');
const geojson = kml(kmlDom);

console.log('Writing GeoJSON...');
fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync('./public/prgeol.geojson', JSON.stringify(geojson));

console.log('Conversion complete!');

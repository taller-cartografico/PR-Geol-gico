import fs from 'fs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { execSync } from 'child_process';

console.log('Reading KML file...');
const kmlFile = fs.readFileSync('../prgeol.kml', 'utf8');

console.log('Parsing XML...');
const kmlDom = new DOMParser().parseFromString(kmlFile, 'text/xml');

console.log('Converting to GeoJSON...');
const geojson = kml(kmlDom);

const palette = ['#1d3a2f', '#a0522d', '#d4a843', '#b8c4bc', '#f2ede4'];
const units = {};

geojson.features.forEach(feature => {
  const name = feature.properties.name || 'Unknown';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % palette.length;
  const color = palette[colorIndex];

  let mapSymbol = '';
  let restOfName = name;
  
  if (name.includes(':')) {
    const parts = name.split(':');
    mapSymbol = parts[0].trim();
    restOfName = parts.slice(1).join(':').trim();
  } else {
    mapSymbol = name.trim();
  }

  let unitName = '';
  let geologicAge = '';
  let descValue = '';

  const props = feature.properties;
  const val = typeof props.description === 'string' ? props.description : (props.description && props.description.value ? props.description.value : '');
  
  if (val) {
    const unitNameMatch = val.match(/<th[^>]*>Unit name<\/th>\s*<td>([^<]+)<\/td>/i);
    const geologicAgeMatch = val.match(/<th[^>]*>Geologic age<\/th>\s*<td>([^<]+)<\/td>/i);
    const descMatch = val.match(/<th[^>]*>Description<\/th>\s*<td>([^<]+)<\/td>/i);

    if (unitNameMatch) unitName = unitNameMatch[1].trim();
    if (geologicAgeMatch) geologicAge = geologicAgeMatch[1].trim();
    if (descMatch) descValue = descMatch[1].trim();
  }

  if (mapSymbol && !units[mapSymbol]) {
    units[mapSymbol] = {
      map_symbol: mapSymbol,
      unit_name: unitName || restOfName,
      geologic_age: geologicAge,
      description: descValue,
      color: color
    };
  }

  feature.properties = {
    s: mapSymbol,
    color: color
  };
});

console.log('Writing intermediary GeoJSON and lookup metadata...');
fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync('./public/prgeol_normalized.geojson', JSON.stringify(geojson));
fs.writeFileSync('./public/geology_units.json', JSON.stringify(units, null, 2));

console.log('Running Mapshaper to simplify polygons...');
try {
  execSync('npx mapshaper ./public/prgeol_normalized.geojson -simplify 5% -o combine-layers ./public/prgeol_simplified.geojson', { stdio: 'inherit' });
  console.log('Removing intermediary files...');
  fs.unlinkSync('./public/prgeol_normalized.geojson');
} catch (err) {
  console.error('Mapshaper failed. Make sure mapshaper is installed.', err);
}

console.log('Conversion complete!');

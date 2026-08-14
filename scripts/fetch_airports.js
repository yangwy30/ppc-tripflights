import fs from 'node:fs/promises';

const SOURCE_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OUTPUT_FILE = new URL('../public/airports.json', import.meta.url);

// An IATA code alone does not mean an airport is bookable. Suggestions should
// contain only airports with current scheduled passenger service.
const EXCLUDED_TYPES = new Set(['closed', 'heliport', 'seaplane_base', 'balloonport']);
const NON_CIVIL_NAME = /\b(?:air\s*base|air force base|army air(?:field| field)|naval air|military air|marine corps air|restricted landing area)\b/i;

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function shortenName(name) {
  return name
    .replace(/\s+(?:International|Regional)?\s*Airport$/i, '')
    .replace(/\s+Airport$/i, '')
    .trim() || name;
}

function buildAirportGroups(csv) {
  const [headers, ...rows] = parseCsv(csv);
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const groups = new Map();
  let excludedNonCivil = 0;

  for (const row of rows) {
    const code = row[column.iata_code]?.trim().toUpperCase();
    const city = row[column.municipality]?.trim();
    const name = row[column.name]?.trim();
    const type = row[column.type]?.trim();
    const scheduledService = row[column.scheduled_service]?.trim();

    if (!/^[A-Z]{3}$/.test(code || '')) continue;
    if (!city || !name || scheduledService !== 'yes' || EXCLUDED_TYPES.has(type)) continue;
    if (NON_CIVIL_NAME.test(name)) {
      excludedNonCivil += 1;
      continue;
    }

    if (!groups.has(city)) groups.set(city, { city, airports: [] });
    const airports = groups.get(city).airports;
    if (!airports.some(airport => airport.code === code)) {
      airports.push({ code, name: shortenName(name) });
    }
  }

  const result = [...groups.values()]
    .map(group => ({ ...group, airports: group.airports.sort((a, b) => a.code.localeCompare(b.code)) }))
    .sort((a, b) => a.city.localeCompare(b.city));

  return { result, excludedNonCivil };
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Airport download failed: HTTP ${response.status}`);

  const { result, excludedNonCivil } = buildAirportGroups(await response.text());
  const airportCount = result.reduce((sum, group) => sum + group.airports.length, 0);
  if (airportCount < 2500) {
    throw new Error(`Refusing to overwrite airport data: only ${airportCount} airports passed validation`);
  }

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(result)}\n`, 'utf8');
  console.log(`Saved ${airportCount} scheduled civil airports in ${result.length} city groups.`);
  console.log(`Excluded ${excludedNonCivil} scheduled airports with explicitly military/restricted names.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

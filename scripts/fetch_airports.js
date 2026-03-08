import fs from 'fs';
import https from 'https';

const URL = 'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json';
const OUTPUT_FILE = './public/airports.json';

https.get(URL, (res) => {
    let rawData = '';

    res.on('data', (chunk) => { rawData += chunk; });

    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);

            // Filter out small airports without IATA codes
            const validAirports = Object.values(data).filter(a => a.iata && a.iata !== '\\N' && a.city);

            const cityGroups = {};
            validAirports.forEach(a => {
                if (!cityGroups[a.city]) {
                    // Just using the first 3 letters of city as fallback cityCode
                    cityGroups[a.city] = {
                        city: a.city,
                        cityCode: a.iata, // Some airports share code with city, but we just need a string to search
                        airports: []
                    };
                }

                // Add airport to city if not already there (dedupe)
                if (!cityGroups[a.city].airports.find(existing => existing.code === a.iata)) {
                    // Make name shorter if possible by removing "International Airport" 
                    const shortName = a.name.replace(/(International |Regional )?Airport/i, '').trim();
                    cityGroups[a.city].airports.push({ code: a.iata, name: shortName || a.name });
                }
            });

            const finalData = Object.values(cityGroups);

            // Ensure public directory exists
            if (!fs.existsSync('./public')) {
                fs.mkdirSync('./public');
            }

            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData));
            console.log(`Successfully parsed ${validAirports.length} global airports into ${finalData.length} distinct city groups.`);
            console.log(`Saved to ${OUTPUT_FILE}`);

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});

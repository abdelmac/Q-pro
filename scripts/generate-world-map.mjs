// Deterministically convert the pinned public-domain Natural Earth dataset into
// a compact, offline SVG basemap. This never reads participant information.
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson';
const response = await fetch(source);
if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
const raw = await response.text();
const collection = JSON.parse(raw);
const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const allowed = new Set(countryCodes);
const localizers = Object.fromEntries(['en', 'fr', 'ro'].map(language => [language, new Intl.DisplayNames([language], { type: 'region' })]));
const countries = countryCodes.map(code => ({ code, ...Object.fromEntries(Object.entries(localizers).map(([language, names]) => [language, names.of(code)])) }));
const n = value => Number(value.toFixed(2));
const paths = collection.features.filter(feature => feature.properties.ISO_A2_EH !== 'AQ').map(feature => {
  const props = feature.properties;
  const code = [props.ISO_A2, props.ISO_A2_EH, props.WB_A2].find(candidate => allowed.has(candidate)) ?? null;
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const d = polygons.flatMap(polygon => polygon.map(ring => ring.map(([longitude, latitude], index) => `${index === 0 ? 'M' : 'L'}${n((longitude + 180) * 960 / 360)},${n((85 - latitude) * 500 / 145)}`).join('') + 'Z')).join('');
  return { id: String(props.NE_ID), code, d };
});
await writeFile(new URL('../src/data/worldMapPaths.json', import.meta.url), JSON.stringify({ source, sourceSha256: createHash('sha256').update(raw).digest('hex'), width: 960, height: 500, paths }) + '\n');
await writeFile(new URL('../src/data/countries.json', import.meta.url), JSON.stringify(countries, null, 2) + '\n');
console.log(`Generated ${paths.length} country shapes and ${countries.length} localized country choices.`);

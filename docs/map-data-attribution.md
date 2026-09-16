# World map geometry

The bundled `src/data/worldMapPaths.json` is generated from Natural Earth 1:110m
Admin 0 countries, version 5.1.2:

https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_admin_0_countries.geojson

Natural Earth's vector data is in the public domain:
https://www.naturalearthdata.com/about/terms-of-use/

Run `node scripts/generate-world-map.mjs` to reproduce the compact equirectangular
SVG paths and localized ISO 3166-1 alpha-2 country/territory list. Country names
come from the platform's Unicode CLDR-backed `Intl.DisplayNames`; their generated
English, French and Romanian values are bundled for offline use. The geometry
source URL and SHA-256 are recorded in the generated JSON.

This intentionally coarse map omits Antarctica and some small territories at
world scale. Every ISO country/territory is still available in the selector and
published-country list. Boundaries follow the upstream dataset and do not express
a position on territorial status. Geometry and labels are static assets, never
respondent locations. There are no external tile, geolocation or tracking requests.

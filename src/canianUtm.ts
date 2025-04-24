export function getUtmZone(lng: number): number {
  if (lng < -180 || lng > 180) {
    throw new Error('Longitude out of range (-180 to 180)');
  }
  const zone = Math.floor((lng + 180) / 6) + 1;
  console.log(`Longitude: ${lng}, UTM Zone: ${zone}`);
  return zone;
}

export const utmCanada = [
  {
    utm_zone: '7N',
    minLng: 144,
    maxLng: 138,
    provinces_territories: 'Yukon (westernmost part)',
    epsg_nad83: 26907,
    epsg_nad83_csrs: 3155,
    proj4:
      '+proj=utm +zone=7 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '8N',
    minLng: 138,
    maxLng: 132,
    provinces_territories: 'Yukon, Northwest Territories',
    epsg_nad83: 26908,
    epsg_nad83_csrs: 3156,
    proj4:
      '+proj=utm +zone=8 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '9N',
    minLng: 132,
    maxLng: 126,
    provinces_territories: 'British Columbia, Yukon, NWT',
    epsg_nad83: 26909,
    epsg_nad83_csrs: 3157,
    proj4:
      '+proj=utm +zone=9 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '10N',
    minLng: 126,
    maxLng: 120,
    provinces_territories: 'British Columbia, NWT, Yukon',
    epsg_nad83: 26910,
    epsg_nad83_csrs: 3158,
    proj4:
      '+proj=utm +zone=10 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '11N',
    minLng: 120,
    maxLng: 114,
    provinces_territories: 'Alberta, British Columbia, NWT',
    epsg_nad83: 26911,
    epsg_nad83_csrs: 3159,
    proj4:
      '+proj=utm +zone=11 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '12N',
    minLng: 114,
    maxLng: 108,
    provinces_territories: 'Alberta, Saskatchewan, NWT',
    epsg_nad83: 26912,
    epsg_nad83_csrs: 3160,
    proj4:
      '+proj=utm +zone=12 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '13N',
    minLng: 108,
    maxLng: 102,
    provinces_territories: 'Saskatchewan, Manitoba, NWT',
    epsg_nad83: 26913,
    epsg_nad83_csrs: 3161,
    proj4:
      '+proj=utm +zone=13 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '14N',
    minLng: 102,
    maxLng: 96,
    provinces_territories: 'Manitoba, Nunavut, Saskatchewan',
    epsg_nad83: 26914,
    epsg_nad83_csrs: 3162,
    proj4:
      '+proj=utm +zone=14 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '15N',
    minLng: 96,
    maxLng: 90,
    provinces_territories: 'Manitoba, Ontario, Nunavut',
    epsg_nad83: 26915,
    epsg_nad83_csrs: 3163,
    proj4:
      '+proj=utm +zone=15 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '16N',
    minLng: 90,
    maxLng: 84,
    provinces_territories: 'Ontario, Nunavut',
    epsg_nad83: 26916,
    epsg_nad83_csrs: 3164,
    proj4:
      '+proj=utm +zone=16 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '17N',
    minLng: 84,
    maxLng: 78,
    provinces_territories: 'Ontario, Quebec, Nunavut',
    epsg_nad83: 26917,
    epsg_nad83_csrs: 3165,
    proj4:
      '+proj=utm +zone=17 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '18N',
    minLng: 78,
    maxLng: 72,
    provinces_territories: 'Quebec, Nunavut',
    epsg_nad83: 26918,
    epsg_nad83_csrs: 3166,
    proj4:
      '+proj=utm +zone=18 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '19N',
    minLng: 72,
    maxLng: 66,
    provinces_territories: 'Quebec, Labrador, Nunavut',
    epsg_nad83: 26919,
    epsg_nad83_csrs: 3167,
    proj4:
      '+proj=utm +zone=19 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '20N',
    minLng: 66,
    maxLng: 60,
    provinces_territories: 'Quebec, Labrador, Newfoundland',
    epsg_nad83: 26920,
    epsg_nad83_csrs: 3168,
    proj4:
      '+proj=utm +zone=20 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '21N',
    minLng: 60,
    maxLng: 54,
    provinces_territories: 'Newfoundland and Labrador',
    epsg_nad83: 26921,
    epsg_nad83_csrs: 3169,
    proj4:
      '+proj=utm +zone=21 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
  {
    utm_zone: '22N',
    minLng: 54,
    maxLng: 48,
    provinces_territories: 'Newfoundland and Labrador (easternmost part)',
    epsg_nad83: 26922,
    epsg_nad83_csrs: 3170,
    proj4:
      '+proj=utm +zone=22 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
  },
];

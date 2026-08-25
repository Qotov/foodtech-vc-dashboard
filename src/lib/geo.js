// ISO alpha-2 -> numeric ISO 3166-1 (matches world-atlas topojson `id`)
export const ISO_A2_TO_NUM = {
  US: '840', CA: '124', MX: '484', GB: '826', DE: '276', FR: '250', NL: '528',
  ES: '724', IT: '380', SE: '752', DK: '208', FI: '246', NO: '578', IE: '372',
  BE: '056', AT: '040', CH: '756', PT: '620', PL: '616', EE: '233', IL: '376',
  AE: '784', SA: '682', TN: '788', CN: '156', IN: '356', JP: '392', KR: '410',
  SG: '702', AU: '036', NZ: '554', ID: '360', PH: '608', BR: '076', AR: '032',
  ZA: '710', NG: '566', KE: '404', CL: '152', CZ: '203', EG: '818', GR: '300',
  IS: '352', LT: '440',
};
export const NUM_TO_ISO_A2 = Object.fromEntries(Object.entries(ISO_A2_TO_NUM).map(([a, n]) => [n, a]));

// city -> [lng, lat] for the cities present in the dataset
export const CITY_COORDS = {
  'Adelaide|AU': [138.6, -34.93], 'Bangalore|IN': [77.59, 12.97], 'Barcelona|ES': [2.17, 41.39],
  'Bath|GB': [-2.36, 51.38], 'Berlin|DE': [13.4, 52.52], 'Breda|NL': [4.78, 51.57],
  'Christchurch|NZ': [172.64, -43.53], 'Copenhagen|DK': [12.57, 55.68], 'Delft|NL': [4.36, 52.01],
  'Fredericton|CA': [-66.64, 45.96], 'Geleen|NL': [5.83, 50.97], 'Ghent|BE': [3.72, 51.05],
  'Half Moon Bay|US': [-122.43, 37.46], 'Hyderabad|IN': [78.47, 17.38], 'Jersey City|US': [-74.08, 40.73],
  'Kailua-Kona|US': [-155.99, 19.64], 'Lausanne|CH': [6.63, 46.52], 'Lincoln|US': [-96.7, 40.81],
  'London|GB': [-0.13, 51.51], 'Melbourne|AU': [144.96, -37.81], 'Milan|IT': [9.19, 45.46],
  'Montreal|CA': [-73.57, 45.5], 'Ness Ziona|IL': [34.79, 31.93], 'New York|US': [-74.01, 40.71],
  'Paris|FR': [2.35, 48.86], 'Plymouth|GB': [-4.14, 50.37], 'Potsdam|DE': [13.06, 52.4],
  'Raisio|FI': [22.17, 60.49], 'Riyadh|SA': [46.72, 24.71], 'San Francisco|US': [-122.42, 37.77],
  'South San Francisco|US': [-122.41, 37.65], 'Tallinn|EE': [24.75, 59.44], 'Tel Aviv|IL': [34.78, 32.08],
  'Toulouse|FR': [1.44, 43.6], 'Wageningen|NL': [5.66, 51.97], 'Warsaw|PL': [21.01, 52.23],
  'Yokneam|IL': [35.1, 32.66],
  'Ahmedabad|IN': [72.57, 23.02], 'Almería|ES': [-2.46, 36.84], 'Amstelveen|NL': [4.86, 52.31],
  'Amsterdam|NL': [4.9, 52.37], 'Athens|GR': [23.73, 37.98], 'Auckland|NZ': [174.76, -36.85],
  'Belo Horizonte|BR': [-43.94, -19.92], 'Berkeley|US': [-122.27, 37.87], 'Bhopal|IN': [77.41, 23.26],
  'Boston|US': [-71.06, 42.36], 'Brisbane|AU': [153.03, -27.47], 'Brussels|BE': [4.35, 50.85],
  'Cairo|EG': [31.24, 30.04], 'Cambridge|GB': [0.12, 52.21], 'Cologne|DE': [6.96, 50.94],
  'Davis|US': [-121.74, 38.55], 'Delhi|IN': [77.1, 28.7], 'Dubai|AE': [55.27, 25.2],
  'Essen|DE': [7.01, 51.46], 'Geneva|CH': [6.14, 46.2], 'Gothenburg|SE': [11.97, 57.71],
  'Haverhill|GB': [0.44, 52.08], 'Kitchener|CA': [-80.49, 43.45], 'Leipzig|DE': [12.37, 51.34],
  'Leiria|PT': [-8.81, 39.74], 'London, Ontario|CA': [-81.25, 42.98], 'Los Angeles|US': [-118.24, 34.05],
  'Lyon|FR': [4.84, 45.76], 'Maastricht|NL': [5.69, 50.85], 'Maidenhead|GB': [-0.72, 51.52],
  'Munich|DE': [11.58, 48.14], 'Nairobi|KE': [36.82, -1.29], 'Norwich|GB': [1.3, 52.63],
  'Oxford|GB': [-1.26, 51.75], 'Papendorf|DE': [12.13, 54.05], 'Pescadero|US': [-122.38, 37.25],
  'Prague|CZ': [14.44, 50.08], 'Rennes|FR': [-1.68, 48.11], 'Sacramento|US': [-121.49, 38.58],
  'San Diego|US': [-117.16, 32.72], 'San Jose|US': [-121.89, 37.34], 'San Leandro|US': [-122.16, 37.72],
  'Singapore|SG': [103.85, 1.29], 'St. Louis|US': [-90.2, 38.63], 'Sydney|AU': [151.21, -33.87],
  'Toronto|CA': [-79.38, 43.65], 'Valbonne|FR': [7.01, 43.64], 'Vancouver|CA': [-123.12, 49.28],
  'Vestmannaeyjar|IS': [-20.27, 63.44], 'Vilnius|LT': [25.28, 54.69], 'Vitória|BR': [-40.34, -20.32],
  'Washington|US': [-77.04, 38.91], 'Wuerzburg|DE': [9.95, 49.79], 'Yverdon-les-Bains|CH': [6.64, 46.78],
  'Zurich|CH': [8.54, 47.37],
};

export const cityKey = (city, country) => `${city}|${country}`;

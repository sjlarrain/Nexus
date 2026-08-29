/**
 * US states and their cities, for the step-1 State → City dropdowns.
 *
 * Spec section 2, step 1: "city value stored as 'City, ST'. Changing state clears
 * city." So the canonical value is composed here, not in the component.
 *
 * The city list per state is the largest metros — enough for a national deck without
 * shipping a gazetteer. Add to it freely; nothing derives from its size.
 */

export type StateCode = keyof typeof CITIES_BY_STATE;

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export const CITIES_BY_STATE = {
  AL: ['Birmingham', 'Huntsville', 'Montgomery', 'Mobile'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau'],
  AZ: ['Phoenix', 'Tucson', 'Scottsdale', 'Tempe', 'Mesa'],
  AR: ['Little Rock', 'Fayetteville', 'Bentonville'],
  CA: [
    'San Francisco',
    'Los Angeles',
    'San Diego',
    'San Jose',
    'Oakland',
    'Palo Alto',
    'Mountain View',
    'Santa Monica',
    'Sacramento',
    'Berkeley',
    'Irvine',
    'Pasadena',
  ],
  CO: ['Denver', 'Boulder', 'Colorado Springs', 'Fort Collins'],
  CT: ['Stamford', 'Hartford', 'New Haven', 'Greenwich'],
  DE: ['Wilmington', 'Newark', 'Dover'],
  DC: ['Washington'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'St. Petersburg'],
  GA: ['Atlanta', 'Savannah', 'Athens', 'Augusta'],
  HI: ['Honolulu', 'Hilo'],
  ID: ['Boise', 'Meridian', 'Idaho Falls'],
  IL: ['Chicago', 'Evanston', 'Naperville', 'Springfield'],
  IN: ['Indianapolis', 'Bloomington', 'Fort Wayne', 'South Bend'],
  IA: ['Des Moines', 'Iowa City', 'Cedar Rapids'],
  KS: ['Kansas City', 'Wichita', 'Overland Park', 'Lawrence'],
  KY: ['Louisville', 'Lexington'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport'],
  ME: ['Portland', 'Bangor'],
  MD: ['Baltimore', 'Bethesda', 'Silver Spring', 'Annapolis'],
  MA: ['Boston', 'Cambridge', 'Somerville', 'Worcester'],
  MI: ['Detroit', 'Ann Arbor', 'Grand Rapids', 'Lansing'],
  MN: ['Minneapolis', 'St. Paul', 'Rochester'],
  MS: ['Jackson', 'Gulfport'],
  MO: ['St. Louis', 'Kansas City', 'Columbia', 'Springfield'],
  MT: ['Bozeman', 'Missoula', 'Billings'],
  NE: ['Omaha', 'Lincoln'],
  NV: ['Las Vegas', 'Reno', 'Henderson'],
  NH: ['Manchester', 'Nashua', 'Portsmouth'],
  NJ: ['Jersey City', 'Newark', 'Hoboken', 'Princeton'],
  NM: ['Albuquerque', 'Santa Fe'],
  NY: ['New York', 'Brooklyn', 'Buffalo', 'Rochester', 'Albany', 'Ithaca'],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Chapel Hill', 'Asheville'],
  ND: ['Fargo', 'Bismarck'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Akron'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman'],
  OR: ['Portland', 'Eugene', 'Bend'],
  PA: ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'State College'],
  RI: ['Providence', 'Newport'],
  SC: ['Charleston', 'Columbia', 'Greenville'],
  SD: ['Sioux Falls', 'Rapid City'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
  TX: ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth', 'Plano'],
  UT: ['Salt Lake City', 'Provo', 'Park City', 'Lehi'],
  VT: ['Burlington', 'Montpelier'],
  VA: ['Arlington', 'Richmond', 'Alexandria', 'Charlottesville', 'Norfolk'],
  WA: ['Seattle', 'Bellevue', 'Tacoma', 'Spokane', 'Redmond'],
  WV: ['Charleston', 'Morgantown'],
  WI: ['Milwaukee', 'Madison', 'Green Bay'],
  WY: ['Cheyenne', 'Jackson'],
} as const satisfies Record<string, readonly string[]>;

/** The canonical stored form of a location (spec section 2, step 1). */
export function formatCity(city: string, state: StateCode): string {
  return `${city}, ${state}`;
}

export function citiesForState(state: string): readonly string[] {
  return CITIES_BY_STATE[state as StateCode] ?? [];
}

/** Maps a full state name (what the dropdown shows) back to its code. */
export function stateCodeForName(name: string): StateCode | null {
  const entry = Object.entries(STATE_NAMES).find(([, full]) => full === name);
  return entry ? (entry[0] as StateCode) : null;
}

export function stateNameForCode(code: string): string {
  return STATE_NAMES[code] ?? '';
}

/** Splits "Austin, TX" back into its parts. Returns null for anything malformed. */
export function parseCity(value: string): { city: string; state: StateCode } | null {
  const match = /^(.+), ([A-Z]{2})$/.exec(value);
  if (!match) return null;
  const [, city, state] = match;
  if (!city || !state || !(state in CITIES_BY_STATE)) return null;
  return { city, state: state as StateCode };
}

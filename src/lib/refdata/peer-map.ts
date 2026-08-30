import { GICS_SECTORS, type GicsSector } from '@/lib/refdata/taxonomy';

/**
 * Company peer map — spec section 2, step 2 ("Where you can open a door") and
 * section 3 (target companies).
 *
 * "Company suggestions come from a peer map keyed by employer name; anything a user
 * adds is merged into the same chip list so it renders as an already-selected cell."
 * (spec section 6). `suggestCompanies` does exactly that merge.
 *
 * The Figma row is the one the spec names explicitly; the rest follow the same idea
 * — companies a person at X plausibly has a warm line into.
 */

export const PEER_MAP: Record<string, readonly string[]> = {
  // Named in the spec.
  Figma: ['Notion', 'Canva', 'Adobe', 'Linear', 'Airtable'],

  // Design / productivity
  Notion: ['Figma', 'Linear', 'Airtable', 'Coda', 'Asana'],
  Canva: ['Figma', 'Adobe', 'Notion', 'Miro'],
  Adobe: ['Figma', 'Canva', 'Autodesk', 'Salesforce'],
  Linear: ['Figma', 'Notion', 'Vercel', 'Stripe'],
  Airtable: ['Notion', 'Figma', 'Asana', 'Smartsheet'],

  // Marketplaces / consumer
  DoorDash: ['Uber', 'Instacart', 'Gopuff', 'Grubhub', 'Lyft'],
  Uber: ['Lyft', 'DoorDash', 'Instacart', 'Airbnb'],
  Lyft: ['Uber', 'DoorDash', 'Bird'],
  Airbnb: ['Booking.com', 'Expedia', 'Vrbo', 'Uber'],
  Instacart: ['DoorDash', 'Gopuff', 'Shipt'],

  // Fintech
  Stripe: ['Square', 'Plaid', 'Adyen', 'Brex', 'Ramp'],
  Plaid: ['Stripe', 'Brex', 'Ramp', 'Chime'],
  Brex: ['Ramp', 'Stripe', 'Plaid', 'Mercury'],
  Ramp: ['Brex', 'Stripe', 'Mercury'],
  Robinhood: ['Coinbase', 'Chime', 'SoFi'],
  Coinbase: ['Robinhood', 'Kraken', 'Circle'],

  // Big tech
  Google: ['Meta', 'Microsoft', 'Amazon', 'Apple', 'YouTube'],
  Meta: ['Google', 'Snap', 'Pinterest', 'TikTok'],
  Amazon: ['Google', 'Microsoft', 'Apple', 'Walmart'],
  Microsoft: ['Google', 'Amazon', 'LinkedIn', 'GitHub'],
  Apple: ['Google', 'Microsoft', 'Meta'],
  Netflix: ['Spotify', 'Disney', 'Hulu', 'Warner Bros. Discovery'],
  Spotify: ['Netflix', 'SoundCloud', 'Apple'],
  LinkedIn: ['Microsoft', 'Meta', 'Indeed'],

  // Enterprise SaaS
  Salesforce: ['Slack', 'HubSpot', 'Workday', 'ServiceNow'],
  Slack: ['Salesforce', 'Notion', 'Zoom', 'Atlassian'],
  Atlassian: ['Slack', 'Linear', 'GitHub', 'Asana'],
  Snowflake: ['Databricks', 'MongoDB', 'Confluent'],
  Databricks: ['Snowflake', 'Confluent', 'Scale AI'],
  Datadog: ['New Relic', 'Splunk', 'Grafana Labs'],
  Twilio: ['SendGrid', 'Stripe', 'Zendesk'],

  // AI
  OpenAI: ['Anthropic', 'Scale AI', 'Hugging Face', 'Cohere'],
  Anthropic: ['OpenAI', 'Scale AI', 'Hugging Face'],
  'Scale AI': ['OpenAI', 'Databricks', 'Anthropic'],

  // Consulting / finance
  McKinsey: ['Bain', 'BCG', 'Deloitte'],
  Bain: ['McKinsey', 'BCG', 'Bridgewater'],
  BCG: ['McKinsey', 'Bain', 'Deloitte'],
  'Goldman Sachs': ['Morgan Stanley', 'J.P. Morgan', 'Blackstone', 'Citadel'],
  'J.P. Morgan': ['Goldman Sachs', 'Morgan Stanley', 'Citi'],
  Blackstone: ['KKR', 'Apollo', 'Carlyle'],

  // Health / bio
  Oscar: ['Devoted Health', 'Ro', 'Cedar'],
  Ro: ['Hims & Hers', 'Oscar', 'Cedar'],
  'Flatiron Health': ['Tempus', 'Komodo Health', 'Verily'],
};

/**
 * Shown when the employer is not in the map, or when the map row is short. Broad
 * household names, so the chips never come up empty.
 */
export const FALLBACK_COMPANIES: readonly string[] = [
  'Google',
  'Meta',
  'Amazon',
  'Microsoft',
  'Apple',
  'Stripe',
  'Airbnb',
  'Uber',
  'DoorDash',
  'Notion',
  'Figma',
  'Salesforce',
  'Netflix',
  'Spotify',
  'LinkedIn',
];

/** Companies grouped by the industry a fixture person at one would plausibly claim. */
/**
 * Which GICS sector each known employer sits in. GICS is coarse by design, so a
 * software company and a bank both land in one of eleven buckets — that is the
 * taxonomy the product now uses end to end (docs/decisions.md).
 */
export const COMPANY_INDUSTRY: Record<string, GicsSector> = {
  Figma: 'Information Technology',
  Notion: 'Information Technology',
  Canva: 'Information Technology',
  Adobe: 'Information Technology',
  Linear: 'Information Technology',
  Airtable: 'Information Technology',
  DoorDash: 'Consumer Discretionary',
  Uber: 'Industrials',
  Lyft: 'Industrials',
  Airbnb: 'Consumer Discretionary',
  Instacart: 'Consumer Staples',
  Stripe: 'Financials',
  Plaid: 'Financials',
  Brex: 'Financials',
  Ramp: 'Financials',
  Robinhood: 'Financials',
  Coinbase: 'Financials',
  Google: 'Communication Services',
  Meta: 'Communication Services',
  Amazon: 'Consumer Discretionary',
  Microsoft: 'Information Technology',
  Apple: 'Information Technology',
  Netflix: 'Communication Services',
  Spotify: 'Communication Services',
  LinkedIn: 'Communication Services',
  Salesforce: 'Information Technology',
  Slack: 'Information Technology',
  Atlassian: 'Information Technology',
  Snowflake: 'Information Technology',
  Databricks: 'Information Technology',
  Datadog: 'Information Technology',
  Twilio: 'Information Technology',
  OpenAI: 'Information Technology',
  Anthropic: 'Information Technology',
  'Scale AI': 'Information Technology',
  McKinsey: 'Industrials',
  Bain: 'Industrials',
  BCG: 'Industrials',
  'Goldman Sachs': 'Financials',
  'J.P. Morgan': 'Financials',
  Blackstone: 'Financials',
  Oscar: 'Health Care',
  Ro: 'Health Care',
  'Flatiron Health': 'Health Care',
};

/** Every company the app knows about, deduplicated. */
export function knownCompanies(): string[] {
  const all = new Set<string>(Object.keys(PEER_MAP));
  for (const peers of Object.values(PEER_MAP)) for (const peer of peers) all.add(peer);
  for (const company of FALLBACK_COMPANIES) all.add(company);
  return [...all].sort((a, b) => a.localeCompare(b));
}

/**
 * Suggestions for the door / target-company chip grid.
 *
 * `selected` is merged in and returned first, so a company the user typed themselves
 * renders as an already-selected cell rather than disappearing (spec section 6).
 * The employer itself is never suggested — you cannot open a door at your own desk.
 */
export function suggestCompanies(
  employer: string,
  selected: readonly string[] = [],
  limit = 8,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const employerKey = employer.trim().toLowerCase();

  const push = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || key === employerKey || seen.has(key)) return;
    seen.add(key);
    out.push(name.trim());
  };

  for (const name of selected) push(name);
  for (const name of PEER_MAP[employer.trim()] ?? []) push(name);
  for (const name of FALLBACK_COMPANIES) {
    if (out.length >= limit) break;
    push(name);
  }

  return out.slice(0, Math.max(limit, selected.length));
}

export function industryForCompany(company: string): GicsSector {
  return COMPANY_INDUSTRY[company.trim()] ?? GICS_SECTORS[0];
}

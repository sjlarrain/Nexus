/**
 * Sectors, positions, and interests — the option sets behind the multi-select grids
 * in onboarding steps 2, 3, and 4.
 *
 * Kept as plain arrays rather than Firestore documents: the schemas validate against
 * them, so changing one is a code change with a test behind it.
 *
 * Industries are the eleven GICS sectors. Positions are the per-sector list in
 * docs/Others/GICS Positions.md, which is why step 2's "Function" grid and step 3's
 * "Roles" grid are both driven by `positionsForSectors` rather than one flat list.
 */

/** The eleven GICS sectors, in GICS order. */
export const GICS_SECTORS = [
  'Energy',
  'Materials',
  'Industrials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Health Care',
  'Financials',
  'Information Technology',
  'Communication Services',
  'Utilities',
  'Real Estate',
] as const;
export type GicsSector = (typeof GICS_SECTORS)[number];

/**
 * The escape hatch on every taxonomy grid. Selecting it reveals a text field; the
 * value the user types is appended to the same array as a plain string, so it lives
 * on their profile only and never enters the shared taxonomy (docs/decisions.md).
 */
export const OTHER_OPTION = 'Other';

/** What the sector grid actually renders. */
export const SECTOR_OPTIONS = [...GICS_SECTORS, OTHER_OPTION] as const;

/**
 * Positions within each sector, from docs/Others/GICS Positions.md.
 *
 * Labels are the source list minus its explanatory parentheticals — "Finance &
 * Treasury (capital-intensive project funding)" is a note to the reader, not a chip
 * label. Short acronyms that read as part of the name (HSE, FP&A) are kept.
 */
export const POSITIONS_BY_SECTOR: Record<GicsSector, readonly string[]> = {
  Energy: [
    'Operations',
    'Health, Safety & Environment (HSE)',
    'Engineering & Technical Services',
    'Finance & Treasury',
    'Supply Chain & Logistics',
    'Regulatory & Government Affairs',
  ],
  Materials: [
    'Operations/Production',
    'Supply Chain & Procurement',
    'R&D/Process Engineering',
    'Environmental, Health & Safety',
    'Sales & Trading',
    'Finance & Cost Accounting',
  ],
  Industrials: [
    'Manufacturing/Operations',
    'Supply Chain & Procurement',
    'Sales & Business Development',
    'Engineering & Product Development',
    'Quality Assurance',
    'Finance & Operations Analytics',
  ],
  'Consumer Discretionary': [
    'Marketing & Brand Management',
    'Sales/Retail Operations',
    'Merchandising',
    'Supply Chain & Logistics',
    'Customer Experience/Service',
    'Finance & Planning (FP&A)',
  ],
  'Consumer Staples': [
    'Supply Chain & Distribution',
    'Manufacturing/Operations',
    'Marketing & Brand Management',
    'Sales',
    'Quality Control & Food Safety',
    'Finance & Cost Management',
  ],
  'Health Care': [
    'R&D/Clinical Development',
    'Regulatory Affairs',
    'Manufacturing/Quality Operations',
    'Sales & Medical Affairs',
    'Compliance & Legal',
    'Finance & Reimbursement/Market Access',
  ],
  Financials: [
    'Risk Management',
    'Compliance & Regulatory Affairs',
    'Sales/Relationship Management',
    'Underwriting/Credit Analysis',
    'Finance & Treasury',
    'IT & Cybersecurity',
  ],
  'Information Technology': [
    'Engineering/Product Development',
    'Sales',
    'Marketing',
    'Customer Success/Support',
    'IT/Infrastructure & Security',
    'Finance & Operations',
  ],
  'Communication Services': [
    'Content/Product Development',
    'Network Operations/Engineering',
    'Sales & Advertising',
    'Marketing',
    'Customer Service',
    'Finance & Regulatory Affairs',
  ],
  Utilities: [
    'Operations & Grid/Plant Management',
    'Engineering & Maintenance',
    'Regulatory Affairs & Rate Cases',
    'Finance & Treasury',
    'Environmental, Health & Safety',
    'Customer Service',
  ],
  'Real Estate': [
    'Property/Asset Management',
    'Leasing & Sales',
    'Development & Construction Management',
    'Finance & Capital Markets',
    'Facilities/Operations',
    'Legal & Compliance',
  ],
};

/**
 * The positions offered for a set of selected sectors: the union, in sector order,
 * deduplicated — several sectors share a position ("Supply Chain & Procurement" is
 * both a Materials and an Industrials role) and it must not appear twice.
 *
 * Sectors the user typed themselves contribute nothing, so a free-text sector leaves
 * the position grid empty and the "Add other" field is the way through.
 */
export function positionsForSectors(sectors: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sector of GICS_SECTORS) {
    if (!sectors.includes(sector)) continue;
    for (const position of POSITIONS_BY_SECTOR[sector]) {
      if (seen.has(position)) continue;
      seen.add(position);
      out.push(position);
    }
  }
  return out;
}

/** Every position across every sector, for validation and fixtures. */
export function allPositions(): string[] {
  return positionsForSectors(GICS_SECTORS);
}

/**
 * Spec section 2, step 4: "What you are into", capped at 16 options so the grid stays
 * one screen. Anything else goes in through the "Something else" field.
 */
export const INTERESTS = [
  'Running',
  'Hiking',
  'Cycling',
  'Weightlifting',
  'Yoga',
  'Soccer',
  'Basketball',
  'Tennis',
  'Cooking',
  'Coffee',
  'Live music',
  'Film',
  'Reading',
  'Photography',
  'Travel',
  'Board games',
] as const;
export type Interest = (typeof INTERESTS)[number];

/**
 * Job titles for the fixture population only.
 *
 * Deliberately not part of the taxonomy: a GICS position ("Engineering/Product
 * Development") is not a title anyone puts on a card, and Title is free text in the
 * product. These exist so a seeded card reads like a real person.
 */
export const FIXTURE_TITLES = [
  'Product Manager',
  'Senior Product Manager',
  'Product Designer',
  'Senior Product Designer',
  'Software Engineer',
  'Senior Software Engineer',
  'Engineering Manager',
  'Data Scientist',
  'Data Analyst',
  'Marketing Manager',
  'Brand Manager',
  'Growth Lead',
  'Account Executive',
  'Enterprise Account Executive',
  'Sales Manager',
  'Operations Manager',
  'Senior Operations Manager',
  'Supply Chain Manager',
  'Financial Analyst',
  'Senior Financial Analyst',
  'Finance Manager',
  'Strategy Manager',
  'Chief of Staff',
  'Consultant',
  'Engagement Manager',
  'Risk Manager',
  'Compliance Manager',
  'Regulatory Affairs Manager',
  'Process Engineer',
  'Quality Assurance Lead',
  'Technical Recruiter',
  'Customer Success Manager',
] as const;

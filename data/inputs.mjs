export const cutoff = '2028-07-20'
export const threshold = 270

export const links = {
  membership: 'https://www.ncsl.org/elections-and-campaigns/national-popular-vote',
  allocation: 'https://www.archives.gov/electoral-college/allocation',
  election: 'https://www.ncsl.org/news/details/2026-state-legislative-elections-the-results-and-what-they-mean',
  compact: 'https://www.nationalpopularvote.com/bill-text',
  legal: 'https://www.congress.gov/crs_external_products/R/PDF/R43823/R43823.8.pdf',
  video: 'https://www.youtube.com/watch?v=mlT1dY4xV8o',
  reporting: 'https://news.ballotpedia.org/2026/11/17/new-democratic-trifectas-in-five-states-could-provide-enough-electoral-votes-for-national-popular-vote-interstate-compact-2/',
  ap: 'https://apnews.com/article/ac5d917e582ee02e813615a91c6a1f5c',
  nevada: 'https://www.leg.state.nv.us/App/NELIS/REL/84th2027/SessionInformation',
  shapiro: 'https://penncapital-star.com/voting/pennsylvanias-democratic-trifecta-renews-calls-to-join-popular-national-vote-compact/',
  ford: 'https://www.kolotv.com/2026/11/12/incoming-nevada-governor-says-electoral-college-was-created-with-racist-underpinnings-calls-state-join-popular-vote-compact/'
}

export const allocation = {
  Alabama: 9, Alaska: 3, Arizona: 11, Arkansas: 6, California: 54, Colorado: 10, Connecticut: 7,
  Delaware: 3, 'District of Columbia': 3, Florida: 30, Georgia: 16, Hawaii: 4, Idaho: 4, Illinois: 19,
  Indiana: 11, Iowa: 6, Kansas: 6, Kentucky: 8, Louisiana: 8, Maine: 4, Maryland: 10, Massachusetts: 11,
  Michigan: 15, Minnesota: 10, Mississippi: 6, Missouri: 10, Montana: 4, Nebraska: 5, Nevada: 6,
  'New Hampshire': 4, 'New Jersey': 14, 'New Mexico': 5, 'New York': 28, 'North Carolina': 16,
  'North Dakota': 3, Ohio: 17, Oklahoma: 7, Oregon: 8, Pennsylvania: 19, 'Rhode Island': 4,
  'South Carolina': 9, 'South Dakota': 3, Tennessee: 11, Texas: 40, Utah: 6, Vermont: 3, Virginia: 13,
  Washington: 12, 'West Virginia': 4, Wisconsin: 10, Wyoming: 3
}

export const seedMembers = {
  California: 2011, Colorado: 2019, Connecticut: 2018, Delaware: 2019, 'District of Columbia': 2010,
  Hawaii: 2008, Illinois: 2008, Maine: 2024, Maryland: 2007, Massachusetts: 2010, Minnesota: 2023,
  'New Jersey': 2008, 'New Mexico': 2019, 'New York': 2014, Oregon: 2019, 'Rhode Island': 2013,
  Vermont: 2011, Virginia: 2026, Washington: 2009
}

export const baseline = [
  { year: 2018, joined: ['Colorado', 'New Mexico'], missed: ['Maine', 'Nevada'], source: 'https://ballotpedia.org/Trifecta_vulnerability_in_the_2018_elections' },
  { year: 2019, joined: [], missed: ['Virginia'], source: 'https://ballotpedia.org/2019_election_analysis%3A_State_government_trifectas' },
  { year: 2022, joined: ['Minnesota'], missed: ['Michigan'], source: 'https://ballotpedia.org/Election_results%2C_2022%3A_State_government_trifectas' }
]

export const states = [
  {
    code: 'PA', name: 'Pennsylvania', governor: 'Josh Shapiro',
    changed: 'Senate flipped', label: 'Governor expressed interest',
    summary: 'Shapiro signaled openness to working with lawmakers. A filing and a Senate floor vote would turn that interest into a legislative path.',
    watch: 'Watch for a new filing, a Senate committee referral and a clear commitment from Shapiro.',
    signals: [{ label: 'Governor open to exploring adoption', shift: 0.30, url: links.shapiro }],
    bills: [{ id: 'HB 270', session: 2025, stage: 'introduced', date: '2025-04-09', closes: '2026-11-30', url: 'https://www.palegis.us/legislation/bills/2025/hb0270' }]
  },
  {
    code: 'MI', name: 'Michigan', governor: 'Jocelyn Benson',
    changed: 'House flipped', label: 'Prior trifecta stalled',
    summary: 'Michigan considered the compact during its 2023–24 Democratic trifecta and did not enact it. Benson’s position and a House floor vote are key signals.',
    watch: 'Watch for a new bill, action by House leadership and a public position from Benson.',
    signals: [{ label: 'Previous Democratic trifecta did not enact the compact', shift: -0.25, url: links.reporting }],
    bills: [{ id: 'HB 6213', session: 2025, stage: 'introduced', date: '2026-07-03', closes: '2026-12-31', url: 'https://www.legislature.mi.gov/Bills/Bill?ObjectName=2026-HB-6213&printerFriendly=true' }]
  },
  {
    code: 'AZ', name: 'Arizona', governor: 'Katie Hobbs',
    changed: 'House and Senate flipped', label: 'Senate leadership support',
    summary: 'Incoming Senate President Priya Sundareshan said her caucus is prepared to take up the compact. Hobbs’s position is a key open question.',
    watch: 'Watch for a new filing in either chamber and a public commitment from Hobbs.',
    signals: [{ label: 'Incoming Senate president signaled agenda support', shift: 0.30, url: links.reporting }],
    bills: [
      { id: 'SB 1300', session: 2026, stage: 'closed', date: '2026-06-13', url: 'https://apps.azleg.gov/BillStatus/BillOverview/84834' },
      { id: 'HB 4013', session: 2026, stage: 'closed', date: '2026-06-13', url: 'https://apps.azleg.gov/BillStatus/BillOverview/85524' }
    ]
  },
  {
    code: 'WI', name: 'Wisconsin', governor: 'David Crowley',
    changed: 'House and Senate flipped', label: 'Early-session priority',
    summary: 'Sen. Kelda Roys identified the compact as an early-session priority. Gov.-elect Crowley expressed interest in talks with legislators.',
    watch: 'Watch for companion bills, early committee notices and Crowley’s position on signing.',
    signals: [{ label: 'Public legislative priority and governor-elect interest', shift: 0.45, url: links.reporting }],
    bills: [
      { id: 'SB 1117', session: 2025, stage: 'closed', date: '2026-03-23', url: 'https://docs.legis.wisconsin.gov/2025/proposals/sb1117' },
      { id: 'AB 1152', session: 2025, stage: 'closed', date: '2026-03-23', url: 'https://docs.legis.wisconsin.gov/2025/proposals/ab1152' }
    ]
  },
  {
    code: 'NV', name: 'Nevada', governor: 'Aaron Ford',
    changed: 'Governor flipped', label: 'Governor-elect supports joining',
    summary: 'Ford supports joining. Both chambers passed a bill in 2019 before a veto. The 2027 regular session is the main opportunity before July 2028.',
    watch: 'Watch for a standalone bill in the 120-day session beginning February 1, 2027. A constitutional amendment has a longer path.',
    windowEnd: '2027-05-31',
    signals: [
      { label: 'Governor-elect publicly supports adoption', shift: 0.60, url: links.ford },
      { label: 'One regular legislative session before the cutoff', shift: -0.35, url: links.nevada },
      { label: 'Both chambers previously passed a standalone bill', shift: 0.20, url: 'https://www.leg.state.nv.us/App/NELIS/REL/80th2019/Bills/Vetoed' }
    ],
    bills: [{ id: 'AJR 6', session: 2025, stage: 'closed', date: '2025-06-03', route: 'amendment', url: 'https://www.leg.state.nv.us/App/NELIS/REL/83rd2025/Bill/11957' }]
  }
]

export const seedNews = [
  { date: '2026-11-17', title: 'Five new Democratic trifectas could clear the compact threshold', source: 'Ballotpedia', url: links.reporting, states: [], tag: 'Legislative outlook' },
  { date: '2026-11-12', title: 'Nevada Gov.-elect Aaron Ford calls for joining the compact', source: 'KOLO', url: links.ford, states: ['NV'], tag: 'Governor position' },
  { date: '2026-11-10', title: 'New statehouse majorities open a path to compact adoption', source: 'Associated Press', url: links.ap, states: [], tag: 'Legislative outlook' },
  { date: '2026-11-07', title: 'Pennsylvania lawmakers revisit the compact after the Senate flip', source: 'Pennsylvania Capital-Star', url: links.shapiro, states: ['PA'], tag: 'Governor position' }
]

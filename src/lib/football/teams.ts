// Team configuration for URL routing and database normalization
// Add new teams by simply adding entries to this array

export interface TeamConfig {
  id: string;           // Canonical DB name exactly as stored (e.g., "Manchester City")
  slug: string;         // URL slug (e.g., "manchester-city")
  aliases?: string[];   // Known variants (e.g., ["Man City", "Man. City"])
  league: string;       // Competition ID from competitions.ts (e.g., "epl", "laliga")
}

export const TEAMS: TeamConfig[] = [
  // Premier League (EPL)
  { id: 'Arsenal', slug: 'arsenal', league: 'epl' },
  { id: 'Aston Villa', slug: 'aston-villa', league: 'epl' },
  { id: 'Bournemouth', slug: 'bournemouth', league: 'epl', aliases: ['AFC Bournemouth'] },
  { id: 'Brentford', slug: 'brentford', league: 'epl' },
  { id: 'Brighton', slug: 'brighton', league: 'epl', aliases: ['Brighton & Hove Albion'] },
  { id: 'Burnley', slug: 'burnley', league: 'epl' },
  { id: 'Chelsea', slug: 'chelsea', league: 'epl' },
  { id: 'Crystal Palace', slug: 'crystal-palace', league: 'epl' },
  { id: 'Everton', slug: 'everton', league: 'epl' },
  { id: 'Fulham', slug: 'fulham', league: 'epl' },
  { id: 'Leeds', slug: 'leeds', league: 'epl', aliases: ['Leeds United'] },
  { id: 'Liverpool', slug: 'liverpool', league: 'epl' },
  { id: 'Manchester City', slug: 'manchester-city', league: 'epl', aliases: ['Man City', 'Man. City'] },
  { id: 'Manchester United', slug: 'manchester-united', league: 'epl', aliases: ['Man United', 'Man. United'] },
  { id: 'Newcastle', slug: 'newcastle', league: 'epl', aliases: ['Newcastle United'] },
  { id: 'Nottingham Forest', slug: 'nottingham-forest', league: 'epl' },
  { id: 'Sunderland', slug: 'sunderland', league: 'epl' },
  { id: 'Tottenham', slug: 'tottenham', league: 'epl', aliases: ['Spurs', 'Tottenham Hotspur'] },
  { id: 'West Ham', slug: 'west-ham', league: 'epl', aliases: ['West Ham United'] },
  { id: 'Wolves', slug: 'wolves', league: 'epl', aliases: ['Wolverhampton', 'Wolverhampton Wanderers'] },

  // La Liga
  { id: 'Alaves', slug: 'alaves', league: 'laliga', aliases: ['Deportivo Alaves'] },
  { id: 'Athletic Club', slug: 'athletic-club', league: 'laliga', aliases: ['Athletic Bilbao'] },
  { id: 'Atletico Madrid', slug: 'atletico-madrid', league: 'laliga', aliases: ['Atlético Madrid', 'Atleti'] },
  { id: 'Barcelona', slug: 'barcelona', league: 'laliga', aliases: ['FC Barcelona', 'Barça'] },
  { id: 'Celta Vigo', slug: 'celta-vigo', league: 'laliga', aliases: ['Celta de Vigo'] },
  { id: 'Elche', slug: 'elche', league: 'laliga', aliases: ['Elche CF'] },
  { id: 'Espanyol', slug: 'espanyol', league: 'laliga', aliases: ['RCD Espanyol'] },
  { id: 'Getafe', slug: 'getafe', league: 'laliga', aliases: ['Getafe CF'] },
  { id: 'Girona', slug: 'girona', league: 'laliga', aliases: ['Girona FC'] },
  { id: 'Levante', slug: 'levante', league: 'laliga', aliases: ['Levante UD'] },
  { id: 'Mallorca', slug: 'mallorca', league: 'laliga', aliases: ['RCD Mallorca'] },
  { id: 'Osasuna', slug: 'osasuna', league: 'laliga', aliases: ['CA Osasuna'] },
  { id: 'Oviedo', slug: 'oviedo', league: 'laliga', aliases: ['Real Oviedo'] },
  { id: 'Rayo Vallecano', slug: 'rayo-vallecano', league: 'laliga' },
  { id: 'Real Betis', slug: 'real-betis', league: 'laliga', aliases: ['Betis'] },
  { id: 'Real Madrid', slug: 'real-madrid', league: 'laliga', aliases: ['Madrid'] },
  { id: 'Real Sociedad', slug: 'real-sociedad', league: 'laliga', aliases: ['Real Sociedad de Fútbol'] },
  { id: 'Sevilla', slug: 'sevilla', league: 'laliga', aliases: ['Sevilla FC'] },
  { id: 'Valencia', slug: 'valencia', league: 'laliga', aliases: ['Valencia CF'] },
  { id: 'Villarreal', slug: 'villarreal', league: 'laliga', aliases: ['Villarreal CF'] },

  // Bundesliga
  { id: '1. FC Heidenheim', slug: '1-fc-heidenheim', league: 'bundesliga', aliases: ['Heidenheim'] },
  { id: '1. FC Köln', slug: '1-fc-koln', league: 'bundesliga', aliases: ['FC Köln', 'Cologne', 'Köln'] },
  { id: '1899 Hoffenheim', slug: '1899-hoffenheim', league: 'bundesliga', aliases: ['Hoffenheim', 'TSG Hoffenheim'] },
  { id: 'Bayer Leverkusen', slug: 'bayer-leverkusen', league: 'bundesliga', aliases: ['Leverkusen'] },
  { id: 'Bayern München', slug: 'bayern-munchen', league: 'bundesliga', aliases: ['Bayern Munich', 'FC Bayern'] },
  { id: 'Borussia Dortmund', slug: 'borussia-dortmund', league: 'bundesliga', aliases: ['Dortmund', 'BVB'] },
  { id: 'Borussia Mönchengladbach', slug: 'borussia-monchengladbach', league: 'bundesliga', aliases: ['Gladbach', "M'gladbach"] },
  { id: 'Eintracht Frankfurt', slug: 'eintracht-frankfurt', league: 'bundesliga', aliases: ['Frankfurt'] },
  { id: 'FC Augsburg', slug: 'fc-augsburg', league: 'bundesliga', aliases: ['Augsburg'] },
  { id: 'FC St. Pauli', slug: 'fc-st-pauli', league: 'bundesliga', aliases: ['St. Pauli'] },
  { id: 'FSV Mainz 05', slug: 'fsv-mainz-05', league: 'bundesliga', aliases: ['Mainz', 'Mainz 05'] },
  { id: 'Hamburger SV', slug: 'hamburger-sv', league: 'bundesliga', aliases: ['Hamburg', 'HSV'] },
  { id: 'RB Leipzig', slug: 'rb-leipzig', league: 'bundesliga', aliases: ['Leipzig'] },
  { id: 'SC Freiburg', slug: 'sc-freiburg', league: 'bundesliga', aliases: ['Freiburg'] },
  { id: 'Union Berlin', slug: 'union-berlin', league: 'bundesliga', aliases: ['1. FC Union Berlin'] },
  { id: 'VfB Stuttgart', slug: 'vfb-stuttgart', league: 'bundesliga', aliases: ['Stuttgart'] },
  { id: 'VfL Wolfsburg', slug: 'vfl-wolfsburg', league: 'bundesliga', aliases: ['Wolfsburg'] },
  { id: 'Werder Bremen', slug: 'werder-bremen', league: 'bundesliga', aliases: ['Bremen'] },

  // Serie A
  { id: 'AC Milan', slug: 'ac-milan', league: 'seriea', aliases: ['Milan'] },
  { id: 'AS Roma', slug: 'as-roma', league: 'seriea', aliases: ['Roma'] },
  { id: 'Atalanta', slug: 'atalanta', league: 'seriea', aliases: ['Atalanta BC'] },
  { id: 'Bologna', slug: 'bologna', league: 'seriea', aliases: ['Bologna FC'] },
  { id: 'Cagliari', slug: 'cagliari', league: 'seriea', aliases: ['Cagliari Calcio'] },
  { id: 'Como', slug: 'como', league: 'seriea', aliases: ['Como 1907'] },
  { id: 'Cremonese', slug: 'cremonese', league: 'seriea', aliases: ['US Cremonese'] },
  { id: 'Fiorentina', slug: 'fiorentina', league: 'seriea', aliases: ['ACF Fiorentina'] },
  { id: 'Genoa', slug: 'genoa', league: 'seriea', aliases: ['Genoa CFC'] },
  { id: 'Inter', slug: 'inter', league: 'seriea', aliases: ['Inter Milan', 'FC Internazionale'] },
  { id: 'Juventus', slug: 'juventus', league: 'seriea', aliases: ['Juve'] },
  { id: 'Lazio', slug: 'lazio', league: 'seriea', aliases: ['SS Lazio'] },
  { id: 'Lecce', slug: 'lecce', league: 'seriea', aliases: ['US Lecce'] },
  { id: 'Napoli', slug: 'napoli', league: 'seriea', aliases: ['SSC Napoli'] },
  { id: 'Parma', slug: 'parma', league: 'seriea', aliases: ['Parma Calcio'] },
  { id: 'Pisa', slug: 'pisa', league: 'seriea', aliases: ['Pisa SC'] },
  { id: 'Sassuolo', slug: 'sassuolo', league: 'seriea', aliases: ['US Sassuolo'] },
  { id: 'Torino', slug: 'torino', league: 'seriea', aliases: ['Torino FC'] },
  { id: 'Udinese', slug: 'udinese', league: 'seriea', aliases: ['Udinese Calcio'] },
  { id: 'Verona', slug: 'verona', league: 'seriea', aliases: ['Hellas Verona'] },

  // Ligue 1
  { id: 'Angers', slug: 'angers', league: 'ligue1', aliases: ['Angers SCO'] },
  { id: 'Auxerre', slug: 'auxerre', league: 'ligue1', aliases: ['AJ Auxerre'] },
  { id: 'Le Havre', slug: 'le-havre', league: 'ligue1', aliases: ['Le Havre AC'] },
  { id: 'Lens', slug: 'lens', league: 'ligue1', aliases: ['RC Lens'] },
  { id: 'Lille', slug: 'lille', league: 'ligue1', aliases: ['LOSC Lille'] },
  { id: 'Lorient', slug: 'lorient', league: 'ligue1', aliases: ['FC Lorient'] },
  { id: 'Lyon', slug: 'lyon', league: 'ligue1', aliases: ['Olympique Lyonnais'] },
  { id: 'Marseille', slug: 'marseille', league: 'ligue1', aliases: ['Olympique de Marseille', 'OM'] },
  { id: 'Metz', slug: 'metz', league: 'ligue1', aliases: ['FC Metz'] },
  { id: 'Monaco', slug: 'monaco', league: 'ligue1', aliases: ['AS Monaco'] },
  { id: 'Nantes', slug: 'nantes', league: 'ligue1', aliases: ['FC Nantes'] },
  { id: 'Nice', slug: 'nice', league: 'ligue1', aliases: ['OGC Nice'] },
  { id: 'Paris FC', slug: 'paris-fc', league: 'ligue1' },
  { id: 'Paris Saint Germain', slug: 'psg', league: 'ligue1', aliases: ['PSG', 'Paris SG'] },
  { id: 'Rennes', slug: 'rennes', league: 'ligue1', aliases: ['Stade Rennais'] },
  { id: 'Stade Brestois 29', slug: 'stade-brestois-29', league: 'ligue1', aliases: ['Brest'] },
  { id: 'Strasbourg', slug: 'strasbourg', league: 'ligue1', aliases: ['RC Strasbourg'] },
  { id: 'Toulouse', slug: 'toulouse', league: 'ligue1', aliases: ['Toulouse FC'] },

  // Eredivisie
  { id: 'AZ Alkmaar', slug: 'az-alkmaar', league: 'eredivisie', aliases: ['AZ'] },
  { id: 'Ajax', slug: 'ajax', league: 'eredivisie', aliases: ['AFC Ajax'] },
  { id: 'Excelsior', slug: 'excelsior', league: 'eredivisie', aliases: ['SBV Excelsior'] },
  { id: 'FC Volendam', slug: 'fc-volendam', league: 'eredivisie', aliases: ['Volendam'] },
  { id: 'Feyenoord', slug: 'feyenoord', league: 'eredivisie' },
  { id: 'Fortuna Sittard', slug: 'fortuna-sittard', league: 'eredivisie' },
  { id: 'GO Ahead Eagles', slug: 'go-ahead-eagles', league: 'eredivisie', aliases: ['Go Ahead'] },
  { id: 'Groningen', slug: 'groningen', league: 'eredivisie', aliases: ['FC Groningen'] },
  { id: 'Heerenveen', slug: 'heerenveen', league: 'eredivisie', aliases: ['SC Heerenveen'] },
  { id: 'Heracles', slug: 'heracles', league: 'eredivisie', aliases: ['Heracles Almelo'] },
  { id: 'NAC Breda', slug: 'nac-breda', league: 'eredivisie', aliases: ['NAC'] },
  { id: 'NEC Nijmegen', slug: 'nec-nijmegen', league: 'eredivisie', aliases: ['NEC'] },
  { id: 'PEC Zwolle', slug: 'pec-zwolle', league: 'eredivisie', aliases: ['Zwolle'] },
  { id: 'PSV Eindhoven', slug: 'psv-eindhoven', league: 'eredivisie', aliases: ['PSV'] },
  { id: 'Sparta Rotterdam', slug: 'sparta-rotterdam', league: 'eredivisie', aliases: ['Sparta'] },
  { id: 'Telstar', slug: 'telstar', league: 'eredivisie', aliases: ['SC Telstar'] },
  { id: 'Twente', slug: 'twente', league: 'eredivisie', aliases: ['FC Twente'] },
  { id: 'Utrecht', slug: 'utrecht', league: 'eredivisie', aliases: ['FC Utrecht'] },

  // Turkish Super Lig
  { id: 'Alanyaspor', slug: 'alanyaspor', league: 'superlig' },
  { id: 'Antalyaspor', slug: 'antalyaspor', league: 'superlig' },
  { id: 'Başakşehir', slug: 'basaksehir', league: 'superlig', aliases: ['Istanbul Basaksehir'] },
  { id: 'Beşiktaş', slug: 'besiktas', league: 'superlig', aliases: ['Besiktas'] },
  { id: 'Eyüpspor', slug: 'eyupspor', league: 'superlig' },
  { id: 'Fatih Karagümrük', slug: 'fatih-karagumruk', league: 'superlig' },
  { id: 'Fenerbahçe', slug: 'fenerbahce', league: 'superlig', aliases: ['Fenerbahce'] },
  { id: 'Galatasaray', slug: 'galatasaray', league: 'superlig' },
  { id: 'Gazişehir Gaziantep', slug: 'gazisehir-gaziantep', league: 'superlig', aliases: ['Gaziantep'] },
  { id: 'Genclerbirligi', slug: 'genclerbirligi', league: 'superlig' },
  { id: 'Göztepe', slug: 'goztepe', league: 'superlig', aliases: ['Goztepe'] },
  { id: 'Kasımpaşa', slug: 'kasimpasa', league: 'superlig', aliases: ['Kasimpasa'] },
  { id: 'Kayserispor', slug: 'kayserispor', league: 'superlig' },
  { id: 'Kocaelispor', slug: 'kocaelispor', league: 'superlig' },
  { id: 'Konyaspor', slug: 'konyaspor', league: 'superlig' },
  { id: 'Rizespor', slug: 'rizespor', league: 'superlig', aliases: ['Caykur Rizespor'] },
  { id: 'Samsunspor', slug: 'samsunspor', league: 'superlig' },
  { id: 'Trabzonspor', slug: 'trabzonspor', league: 'superlig' },

  // UEFA Champions League
  { id: 'BSC Young Boys', slug: 'bsc-young-boys', league: 'ucl', aliases: ['Young Boys'] },
  { id: 'Benfica', slug: 'benfica', league: 'ucl', aliases: ['SL Benfica'] },
  { id: 'Bodo/Glimt', slug: 'bodo-glimt', league: 'ucl', aliases: ['Bodø/Glimt'] },
  { id: 'Brann', slug: 'brann', league: 'ucl', aliases: ['SK Brann'] },
  { id: 'Celtic', slug: 'celtic', league: 'ucl', aliases: ['Celtic FC'] },
  { id: 'Club Brugge KV', slug: 'club-brugge-kv', league: 'ucl', aliases: ['Club Brugge'] },
  { id: 'Dinamo Zagreb', slug: 'dinamo-zagreb', league: 'ucl' },
  { id: 'FC Basel 1893', slug: 'fc-basel-1893', league: 'ucl', aliases: ['Basel'] },
  { id: 'FC Copenhagen', slug: 'fc-copenhagen', league: 'ucl', aliases: ['Copenhagen'] },
  { id: 'FC Midtjylland', slug: 'fc-midtjylland', league: 'ucl', aliases: ['Midtjylland'] },
  { id: 'FC Porto', slug: 'fc-porto', league: 'ucl', aliases: ['Porto'] },
  { id: 'FCSB', slug: 'fcsb', league: 'ucl', aliases: ['Steaua Bucharest'] },
  { id: 'FK Crvena Zvezda', slug: 'fk-crvena-zvezda', league: 'ucl', aliases: ['Red Star Belgrade', 'Crvena Zvezda'] },
  { id: 'Ferencvarosi TC', slug: 'ferencvarosi-tc', league: 'ucl', aliases: ['Ferencvaros'] },
  { id: 'Genk', slug: 'genk', league: 'ucl', aliases: ['KRC Genk'] },
  { id: 'Kairat Almaty', slug: 'kairat-almaty', league: 'ucl', aliases: ['Kairat'] },
  { id: 'Ludogorets', slug: 'ludogorets', league: 'ucl', aliases: ['PFC Ludogorets'] },
  { id: 'Maccabi Tel Aviv', slug: 'maccabi-tel-aviv', league: 'ucl' },
  { id: 'Malmo FF', slug: 'malmo-ff', league: 'ucl', aliases: ['Malmö FF'] },
  { id: 'Olympiakos Piraeus', slug: 'olympiakos-piraeus', league: 'ucl', aliases: ['Olympiakos'] },
  { id: 'PAOK', slug: 'paok', league: 'ucl', aliases: ['PAOK Thessaloniki'] },
  { id: 'Pafos', slug: 'pafos', league: 'ucl', aliases: ['Pafos FC'] },
  { id: 'Panathinaikos', slug: 'panathinaikos', league: 'ucl', aliases: ['Panathinaikos FC'] },
  { id: 'Plzen', slug: 'plzen', league: 'ucl', aliases: ['Viktoria Plzen'] },
  { id: 'Qarabag', slug: 'qarabag', league: 'ucl', aliases: ['Qarabag FK'] },
  { id: 'Rangers', slug: 'rangers', league: 'ucl', aliases: ['Rangers FC'] },
  { id: 'Red Bull Salzburg', slug: 'red-bull-salzburg', league: 'ucl', aliases: ['Salzburg', 'RB Salzburg'] },
  { id: 'SC Braga', slug: 'sc-braga', league: 'ucl', aliases: ['Braga'] },
  { id: 'Slavia Praha', slug: 'slavia-praha', league: 'ucl', aliases: ['Slavia Prague'] },
  { id: 'Sporting CP', slug: 'sporting-cp', league: 'ucl', aliases: ['Sporting Lisbon', 'Sporting'] },
  { id: 'Sturm Graz', slug: 'sturm-graz', league: 'ucl', aliases: ['SK Sturm Graz'] },
  { id: 'Union St. Gilloise', slug: 'union-st-gilloise', league: 'ucl', aliases: ['Union Saint-Gilloise'] },
];

// Helper functions
export function getTeamBySlug(slug: string): TeamConfig | undefined {
  return TEAMS.find(t => t.slug === slug);
}

export function getTeamByIdOrAlias(name: string): TeamConfig | undefined {
  // First try exact ID match
  const byId = TEAMS.find(t => t.id === name);
  if (byId) return byId;

  // Then search aliases
  return TEAMS.find(t => t.aliases?.includes(name));
}

export function resolveTeamName(slugOrAlias: string): string | undefined {
  const team = getTeamBySlug(slugOrAlias) || getTeamByIdOrAlias(slugOrAlias);
  return team?.id;
}

export function getTeamsByLeague(leagueId: string): TeamConfig[] {
  return TEAMS.filter(t => t.league === leagueId);
}

export function getAllTeamSlugs(): string[] {
  return TEAMS.map(t => t.slug);
}

export function validateTeamMapping(dbTeamNames: string[]): { mapped: string[], unmapped: string[] } {
  const mappedIds = new Set(TEAMS.map(t => t.id));
  const mappedAliases = new Set(TEAMS.flatMap(t => t.aliases || []));
  const mapped = dbTeamNames.filter(n => mappedIds.has(n) || mappedAliases.has(n));
  const unmapped = dbTeamNames.filter(n => !mappedIds.has(n) && !mappedAliases.has(n));
  return { mapped, unmapped };
}

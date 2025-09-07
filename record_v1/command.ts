import * as https from 'https';
const API_KEY = 'HDEV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
console.log('cold start');


type Event = {
  queryStringParameters: {
    uptime: string;
    region?: string;
    puuid?: string;
    username?: string;
    tag?: string;
    name?: string;
    respondWithUptime?: string;
    showLastMapResult?: string;
  }
}

type MmrData = {
  match_id: string,
  tier: {
    id: number,
    name: string,
  },
  map: {
    id: string,
    name: string,
  },
  season: {
    id: string,
    short: string,
  },
  rr: number,
  last_change: number,
  elo: number,
  date: string,
};

type MmrHistoryResponse = {
  status: number,
  results: {
    total: number,
    returned: number,
    before: number,
    after: number,
  },
  data: {
    account: {
      name: string,
      tag: string,
      puuid: string,
    },
    history: MmrData[],
  }
}

type MatchData = {
  meta: {
    id: string,
    map: {
      id: string,
      name: string
    },
    mode: string,
    started_at: string,
    region: 'eu' | 'na' | 'kr' | 'ap' | 'latam' | 'br',
  },
  stats: {
    puuid: string,
    team: string,
  },
  teams: {
    red: number,
    blue: number
  }
}

type StoredMatchesResponse = {
  status: number,
  results: {
    total: number,
    returned: number,
    before: number,
    after: number
  },
  data: MatchData[],
}

const request = <T>(url: string): Promise<T> => {
  let output = '';
  return new Promise((resolve, reject) => {
    const req = https.request(url, (res) => {
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        output += chunk;
      });

      res.on('end', () => {
        let obj = JSON.parse(output);
        if (res.statusCode !== 200) {
          reject(obj.errors);
        }
        resolve(obj);
      });
    });

    req.on('error', (err) => {
      console.log('error making request: ' + err.message);
    });

    req.end();

  });
}

export const handler = async (event: Event) => {

  const puuid = event.queryStringParameters.puuid;
  const uptime = event.queryStringParameters.uptime;
  const respondWithUptime = /true/i.test(event.queryStringParameters.respondWithUptime);
  const showLastMapResult = /true/i.test(event.queryStringParameters.showLastMapResult ?? 'true');
  let region = event.queryStringParameters.region || 'na';
  let username = event.queryStringParameters.username;
  let tag = event.queryStringParameters.tag;
  let name = decodeURI(event.queryStringParameters.name || '');

  const regex = /(?:(?<days>\d+) days?)?(?:(?: and)? |\s|,?\s)?(?:(?<hours>\d+) hours?)?(?:(?: and)? |\s|,\s)?(?:(?<minutes>\d+) min(?:ute)?s?)?(?:(?: and)? |\s)?(?:(?<seconds>\d+) sec(?:ond)?s?)?$/;
  const up = regex.exec(uptime);
  let streamStart = new Date(Date.now());
  streamStart.setUTCDate(streamStart.getUTCDate() - (parseInt(up?.groups?.days ?? '0')));
  streamStart.setUTCHours(streamStart.getUTCHours() - (parseInt(up?.groups?.hours ?? '0')));
  streamStart.setUTCMinutes(streamStart.getUTCMinutes() - (parseInt(up?.groups?.minutes ?? '0')) - 6); // adjust for games starting just before stream starts
  streamStart.setUTCSeconds(streamStart.getUTCSeconds() - (parseInt(up?.groups?.seconds ?? '0')));

  let latestMatch = new Date(0);
  let latestRawElo = 0;
  let earliestMatch = new Date(Date.now() + 100000000000);
  let earliestRawElo = 0;
  let winCount = 0;
  let lossCount = 0;
  let drawCount = 0;
  let numMatches = 0;

  let mmrHistoryUrl: string;
  let matchesUrl: string;

  if (puuid) {
    mmrHistoryUrl = `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr-history/${region}/pc/${puuid}?size=35&api_key=${API_KEY}`;
    matchesUrl = `https://api.henrikdev.xyz/valorant/v1/by-puuid/stored-matches/${region}/${puuid}?mode=competitive&page=1&size=35&api_key=${API_KEY}`;
  } else if (!puuid && username && tag) {
    mmrHistoryUrl = `https://api.henrikdev.xyz/valorant/v2/mmr-history/${region}/pc/${username}/${tag}?size=35&api_key=${API_KEY}`;
    matchesUrl = `https://api.henrikdev.xyz/valorant/v1/stored-matches/${region}/${username}/${tag}?mode=competitive&page=1&size=35&api_key=${API_KEY}`;
  } else if (!puuid && !tag && username) {
    const decoded = decodeURI(username);
    if (decoded.includes('#')) {
      [username, tag] = decoded.split('#');
      // split tag in case we've got region data on the end (the lookup use case)
      if (tag.includes(' ')) {
        [tag, region] = tag.split(' ');
      }
      mmrHistoryUrl = `https://api.henrikdev.xyz/valorant/v2/mmr-history/${region}/pc/${username}/${tag}?size=35&api_key=${API_KEY}`;
      matchesUrl = `https://api.henrikdev.xyz/valorant/v1/stored-matches/${region}/${username}/${tag}?mode=competitive&page=1&size=35&api_key=${API_KEY}`;
    } else {
      return {
        statusCode: 400,
        body: `no tag provided`
      };
    }
  } else {
    return {
      statusCode: 400,
      body: `you must provide one of puuid or account`,
    };
  }

  const mmrHistoryPromise = request<MmrHistoryResponse>(mmrHistoryUrl);
  const matchHistoryPromise = request<StoredMatchesResponse>(matchesUrl);

  const [mmrHistory, matchHistory] = await Promise.all([mmrHistoryPromise, matchHistoryPromise]);
  console.log('all promises resolved');

  const getMmrHistoryResponse = mmrHistory.data.history;

  for (let i = 0; i < getMmrHistoryResponse.length; i++) {
    const { date: dateString, elo: rawElo, tier: tier } = getMmrHistoryResponse[i];
    const mapId = getMmrHistoryResponse[i].map.id;
    const matchStart = new Date(dateString);
    if (matchStart < streamStart) {
      if (tier.id !== 0 && numMatches > 0) {
        earliestRawElo = rawElo;
      }
      break;
    }
    if (mapId !== '') {
      numMatches++;
    }
    if (latestMatch < matchStart) {
      latestMatch = matchStart;
      latestRawElo = rawElo;
    }
    if (earliestMatch > matchStart && tier.id !== 0) {
      earliestMatch = matchStart;
      earliestRawElo = rawElo;
    }
  }

  const filteredMatches = matchHistory.data.filter((match) => match.meta.mode === 'Competitive').slice(0, numMatches);
  filteredMatches.forEach((match) => {
    const { teams } = match;
    const playerTeam = match.stats.team.toLowerCase();
    const otherTeam = playerTeam === 'red' ? 'blue' : 'red';
    if (teams.red === teams.blue) {
      drawCount++;
    } else if (teams[playerTeam] > teams[otherTeam]) {
      winCount++;
    } else {
      lossCount++;
    }
  });

  let fullStreamEloChange = latestRawElo - earliestRawElo;
  if (fullStreamEloChange > 0) {
    // @ts-ignore
    fullStreamEloChange = `+${fullStreamEloChange}`;
  }

  const timeFrame = `${respondWithUptime ? `the previous ${uptime}` : 'this stream'}`;

  let message = `Record for ${name} ${timeFrame}: ${winCount}W-${lossCount}L-${drawCount}D (${fullStreamEloChange}RR)`;

  if (showLastMapResult && filteredMatches[0]) {
    const lastMap = filteredMatches[0];
    const map = lastMap.meta.map.name;
    const playerTeam = lastMap.stats.team.toLowerCase();
    const otherTeam = playerTeam === 'red' ? 'blue' : 'red';
    let result: string;
    if (lastMap.teams.red === lastMap.teams.blue) {
      result = 'draw';
    } else if (lastMap.teams[playerTeam] > lastMap.teams[otherTeam]) {
      result = 'win';
    } else {
      result = 'loss';
    }
    message += ` | Last map (${map}): ${result}`;
  }

  const response = {
    statusCode: 200,
    body: message,
  };
  return response;
};

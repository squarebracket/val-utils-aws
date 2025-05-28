import * as https from 'https';
const API_KEY = 'HDEV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
console.log('cold start');


type Event = {
  queryStringParameters: {
    region?: string;
    puuid?: string;
    username?: string;
    tag?: string;
    name?: string;
    useAccountForName?: boolean;
  }
}

type MmrResponse = {
  status: number,
  data: {
    account: {
      puuid: string,
      name: string,
      tag: string,
    },
    peak: {
      season: {
        id: string,
        short: string,
      },
      ranking_schema: string,
      tier: {
        id: number,
        name: string,
      },
    },
    current: {
      tier: {
        id: number,
        name: string,
      },
      rr: number,
      last_change: number,
      elo: number,
      games_needed_for_rating: number,
      leaderboard_placement: {
        rank: number,
        updated_at: string,
      },
    },
  },
};

type LeaderboardPlayer = {
  is_banned: true,
  puuid: string,
  name: string,
  tag: string,
  leaderboard_rank: number,
  tier: number,
  rr: number,
  wins: number,
};

type LeaderboardResponse = {
  status: number,
  data: {
    players: LeaderboardPlayer[],
  },
};

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
  let region = event.queryStringParameters.region || 'na';
  let username = event.queryStringParameters.username;
  let tag = event.queryStringParameters.tag;
  let name = event.queryStringParameters.name || '';
  let useAccountForName = event.queryStringParameters.useAccountForName;

  let mmrUrl: string;
  let lbUrl: string;

  if (puuid) {
    mmrUrl = `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/${region}/pc/${puuid}?api_key=${API_KEY}`;
  } else if (!puuid && username && tag) {
    mmrUrl = `https://api.henrikdev.xyz/valorant/v3/mmr/${region}/pc/${username}/${tag}?api_key=${API_KEY}`;
  } else if (!puuid && !tag && username) {
    const decoded = decodeURI(username);
    if (decoded.includes('#')) {
      [username, tag] = decoded.split('#');
      // split tag in case we've got region data on the end (the lookup use case)
      if (tag.includes(' ')) {
        [tag, region] = tag.split(' ');
      }
      mmrUrl = `https://api.henrikdev.xyz/valorant/v3/mmr/${region}/pc/${username}/${tag}?api_key=${API_KEY}`;
    } else {
      return {
        statusCode: 400,
        body: `no tag provided`
      };
    }
  } else {
    return {
      statusCode: 400,
      body: `you must provide one of puuid or username/tag`,
    };
  }

  const mmrPromise = request<MmrResponse>(mmrUrl);
  if (puuid) {
    lbUrl = `https://api.henrikdev.xyz/valorant/v3/leaderboard/${region}/pc?puuid=${puuid}&api_key=${API_KEY}`;
  } else {
    lbUrl = `https://api.henrikdev.xyz/valorant/v3/leaderboard/${region}/pc?name=${username}&tag=${tag}&api_key=${API_KEY}`;
  }
  const lbPromise = request<LeaderboardResponse>(lbUrl);

  const [mmrResult, lbResult] = await Promise.allSettled([mmrPromise, lbPromise]);
  console.log('all promises resolved');

  if (mmrResult.status === 'rejected') {
    if (mmrResult.reason[0].status === 404) {
      const lookup = puuid ? puuid : `${username}#${tag}`;
      return {
        statusCode: 404,
        body: `unable to find ${lookup} in ${region} (valid regions are ap, br, eu, kr, latam, na)`,
      };
    } else {
      return {
        statusCode: 500,
        body: mmrResult.reason,
      }
    }
  }

  const mmr = mmrResult.value;
  let message = `${mmr.data.current.tier.name} - ${mmr.data.current.rr}RR`;

  if (lbResult.status === 'fulfilled') {
    try {
      const playerData = lbResult.value.data.players[0];
      message += ` (#${playerData.leaderboard_rank} on the leaderboard with ${playerData.wins} wins)`;
    } catch (e) {
      console.log(e);
    }
  }

  if (!name && useAccountForName) {
    name = `${mmr.data.account.name}#${mmr.data.account.tag}`;
  }

  if (name) {
    message = `Rank for ${name}: ${message}`;
  } else {
    message = `Rank: ${message}`;
  }

  const response = {
    statusCode: 200,
    body: message,
  };
  return response;
};

import * as https from 'https';
const API_KEY = 'HDEV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
console.log('cold start');


type Event = {
  queryStringParameters: {
    username?: string;
    tag?: string;
  }
}

type AccountResponse = {
  status: number,
  data: {
    puuid: string,
    name: string,
    tag: string,
    region: string,
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

  let username = event.queryStringParameters.username;
  let tag = event.queryStringParameters.tag;

  let accountUrl: string;

  if (username && tag) {
    accountUrl = `https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}?api_key=${API_KEY}`;
  } else if (!tag && username) {
    const decoded = decodeURI(username);
    if (decoded.includes('#')) {
      [username, tag] = decoded.split('#');
      accountUrl = `https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}?api_key=${API_KEY}`;
    } else {
      return {
        statusCode: 400,
        body: `no tag provided`
      };
    }
  } else {
    return {
      statusCode: 400,
      body: `you must provide username/tag`,
    };
  }

  const accountData = await request<AccountResponse>(accountUrl);

  let message = `PUUID for ${accountData.data.name}#${accountData.data.tag}: ${accountData.data.puuid}`;
  const response = {
    statusCode: 200,
    body: message,
  };
  return response;
};

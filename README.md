Valorant Twitch Chat Utilities
==============================

This repository stores the cloud resource config and code for spinning up certain useful functions in AWS. The code uses [Henrik's excellent API](https://docs.henrikdev.xyz/valorant/general), so you'll need a Henrik API key in addition to AWS creds if you want to spin up your own resources.

If you'd simply like to use the API as provided, check the usage portion for each endpoint below, which provides examples for various twitch bots that you can copy and paste.

# API Endpoints

## Rank

The rank command endpoint is available at https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1. It can take the following parameters, which are all optional:

`puuid`: The henrikdev puuid for an account  
`username`: The username portion of an account OR a URL-escaped `username#tag` OR a URL-escaped `username#tag region` for lookups as explained below  
`tag`: The tag portion of an account  
`region`: The region to use for the lookup (defaults to `na` if not given)  
`name`: The name to use in the return text  
`useAccountForName`: Boolean for if you want to use the `username#tag` for the returned name  

You must provide either a `puuid` or the username/tag for an account. The return text is in the following format:

```
Rank for name: Immortal 3 - 0RR (#0 on the leaderboard with 0 wins)
```

If you don't provide a `name`, then the `for name` part won't be included. However, you can also provide `useAccountForName` which will use the `username#tag` for the account in the `for name` part.

If the account requested isn't in the leaderboard, the leaderboard part will not be included in the output.

### Example Basic Usage

In the examples below, replace `USERNAME_HERE` with the username portion of an account, `TAG_HERE` with the tag portion of an account, and `REGION_HERE` with the region of the account (one of `ap`, `br`, `eu`, `kr`, `latam` or `na`).

#### Fossabot
```!addcom !rank $(touser) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1?username=USERNAME_HERE&tag=TAG_HERE&region=REGION_HERE)```

#### Nightbot
```!addcom !rank $(touser) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1?username=USERNAME_HERE&tag=TAG_HERE&region=REGION_HERE)```

#### StreamElements
```!cmd add !rank $(touser) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1?username=USERNAME_HERE&tag=TAG_HERE&region=REGION_HERE)```

### Example Lookup Usage

Because the `username` can accept a URL-encoded string of `username#tag region`, you can use the API to execute arbitrary account rank lookups without having to use `exec` blocks to extract username/tag/region to send it along to the API. You _must_ URL-encode it otherwise the `#` will be interpreted as the anchor part of a URL.

If you didn't understand anything I just said, that's fine, you can just copy below and it will work without you having to replace anything. Chatters will then be able to type `!lookup username#tag` (which defaults to `na`) or `!lookup username#tag region` (for looking up an account in a specific region).

#### Fossabot
```!addcom !lookup $(user) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1?username=$(querystring)&useAccountForName=true)```

#### Nightbot
```!addcom !lookup $(user) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1?username=$(querystring)&useAccountForName=true)```

#### StreamElements
```!cmd add !lookup $(sender) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/rank/v1?username=$(queryescape ${1:})&useAccountForName=true)```

## Record

This endpoint returns the W/L/D and RR change over a specified period of a time for a particular account. You can use it to either return the record this stream (by using a bot's `$(uptime)` variable) or a fixed period of time (such as the previous 24 hours). Note that this API will always return the correct information at the cost of a bit of time (about 5s in the absolute worst case). This is different from [nosrettep's API](https://github.com/nosrettep/ValorantRecordCommand/blob/main/LAMBDA_README.md) which uses heuristics to execute faster (about 2.5s in the absolute worst case) at the cost of occasionally returning inaccurate information. For larger channels where `!record` is executed more often, the difference in execution time is minimal.

The record command endpoint is available at https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/record/v1. It can take the following parameters, which are all optional except for `uptime`:

`uptime`: _(Required)_ The period over which to calculate the record  
`puuid`: The henrikdev puuid for an account  
`username`: The username portion of an account OR a URL-escaped `username#tag`  
`tag`: The tag portion of an account  
`region`: The region to use for the lookup (defaults to `na` if not given)  
`name`: The name to use in the return text  
`respondWithUptime`: Set to `true` when using a fixed period of time rather than stream uptime (defaults to `false`)  
`showLastMapResult`: When `true`, show the result of the last map (defaults to `true`)  

You must provide either a `puuid` or the username/tag for an account. The return text is in the following format:

```
Record for name this stream: 4W-8L-0D (-47RR) | Last map (map name): result
```

If you don't provide a `name`, then `name` won't be included. If you set `respondWithUptime` to true, it will respond with `the previous $(uptime)` rather than `this stream`. If `showLastMapResult` is set to `false`, or when there is no game in the time frame provided, then the result of the last map (and the `|` character that precedes it) won't be included.

### Example Basic Usage

In the examples below, replace `USERNAME_HERE` with the username portion of an account, `TAG_HERE` with the tag portion of an account, and `REGION_HERE` with the region of the account (one of `ap`, `br`, `eu`, `kr`, `latam` or `na`).

#### Fossabot
```!addcom !record $(touser) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/record/v1?uptime=$(uptime)&username=USERNAME_HERE&tag=TAG_HERE&region=REGION_HERE)```

#### Nightbot
```!addcom !record $(touser) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/record/v1?uptime=$(twitch $(channel) "{{uptimeLength}}")&username=USERNAME_HERE&tag=TAG_HERE&region=REGION_HERE)```

#### StreamElements
```!cmd add !record $(touser) $(urlfetch https://d1sxhcosc9.execute-api.us-east-2.amazonaws.com/prod/record/v1?uptime=$(uptime)&username=USERNAME_HERE&tag=TAG_HERE&region=REGION_HERE)```

# Deploying with Terraform

As stated before, you will need a Henrik API key. Once you have that just do the normal `terraform init` and `terraform apply`, making sure to specify the `api_key` input variable with your Henrik API key.
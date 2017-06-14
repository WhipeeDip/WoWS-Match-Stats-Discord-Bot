/*
 * File name: wows_bot.js
 * Description: Listens for new WowS matches and checks the stats of WoWS players.
 */

let Promise = require('bluebird');
let Bottleneck = require('bottleneck');
let chokidar = require('chokidar');
let fs = require('fs');
let request = require('request');

// contains the entirety of the WoWS bot
// simply require this and pass in the discord.js logged in client
module.exports = function(client) {
  let module = {}; // the module
  let wgApiLimiter; // bottleneck for WG API requests
  let wowsChannel; // the discord channel to send messages in, used by discord.js
  let arenaJsonPath; // the path to tempArenaInfo.json
  let wargamingApiUrl; // region specific API URL for wargaming
  let wargamingApiId; // paramter with wargaming API application ID
  let arenaJson = {}; // later filled with tempArenaInfo.json 
  let friendlyMsg = []; // messages for friendly team stats
  let enemyMsg = []; // messages for enemy team stats

  // searches WG API for a player ID by name
  // limited amount of requests/second
  module.wgSearchPlayerId = function(playerName) {
    return wgApiLimiter.schedule((playerName) => {
      return new Promise((resolve, reject) => {
        if(playerName === undefined) {
          reject('Player name is empty!');
          return;
        }

        // define API params
        let accountApi = 'account/list/';
        let searchParam = '&search=' + playerName;

        request.get(
            wargamingApiUrl + accountApi + wargamingApiId + searchParam, 
            (error, response, body) => {
          if(error) {
            console.log('Error while contacting WG API: ' + error);
            reject('Error while contacting WG API: ' + error);
            return;
          }

          let jsonBody = JSON.parse(body);
          if(jsonBody.status === 'error') {
            console.log('WG API returned the following error: ' + jsonBody.error);
            reject('WG API returned the following error: ' + jsonBody.error);
            return;
          }

          if(jsonBody.meta.count > 0) { // exists
            let playerId = jsonBody.data[0].account_id;
            console.log('Player: ' + playerName + '\n    ID: ' + playerId);
            resolve(playerId);
            return;
          } else { // no players found
            console.log(playerName + ' was not found. Check your spelling and try again.');
            reject(playerName + ' was not found. Check your spelling and try again.');
            return;
          }
        });
      });
    }, playerName);
  };

  // searches WG API for ship ID by name
  // limited amount of requests/second 
  module.wgSearchShipId = function(shipName) {
    return wgApiLimiter.schedule((shipName) => {
      return new Promise((resolve, reject) => {
        if(shipName === undefined) {
          reject('Ship name is empty!');
          return;
        }

        // define API params
        let encyclopediaApi = 'encyclopedia/ships/';
        let fieldsParam = '&fields=name';

        request.get(
            wargamingApiUrl + encyclopediaApi + wargamingApiId + fieldsParam,
            (error, response, body) => {
          if(error) {
            console.log('Error while contacting WG API: ' + error);
            reject('Error while contacting WG API: ' + error);
            return;
          }

          let jsonBody = JSON.parse(body);
          if(jsonBody.status === 'error') {
            console.log('WG API returned the following error: ' + jsonBody.error);
            reject('WG API returned the following error: ' + jsonBody.error);
            return;
          }

          let jsonData = jsonBody.data;
          for(let dataKey in jsonData) {
            if(!jsonData.hasOwnProperty(dataKey)) {
              continue;
            }
            if(jsonData[dataKey].name === shipName) {
              console.log(shipName + ' is ' + dataKey + '.');
              resolve(dataKey);
              return;
            }
          }

          console.log(shipName + ' was not found. Check your spelling and try again.');
          reject(shipName + ' was not found. Check your spelling and try again.');
          return;
        });
      });
    }, shipName);
  };

  // searches WG API for ship name by ID
  // limited amount of requests/second
  module.wgSearchShipName = function(shipId) {
    return wgApiLimiter.schedule((shipId) => {
      return new Promise((resolve, reject) => {
        if(shipId === undefined) {
          reject('Ship ID is empty!');
        }

        // define API params
        let encyclopediaApi = 'encyclopedia/ships/';
        let searchParam = '&ship_id=' + shipId;
        let fieldsParam = '&fields=name';

        request.get(
            wargamingApiUrl + encyclopediaApi + wargamingApiId + searchParam + fieldsParam,
            (error, response, body) => {
          if(error) {
            console.log('Error while contacting WG API: ' + error);
            reject('Error while contacting WG API: ' + error);
            return;
          }

          let jsonBody = JSON.parse(body);
          if(jsonBody.status === 'error') {
            console.log('WG API returned the following error: ' + jsonBody.error);
            reject('WG API returned the following error: ' + jsonBody.error);
            return;
          }

          let shipName = jsonBody.data[shipId].name;
          if(shipName !== null) {
            console.log(shipId + ' is ' + shipName + '.');
            resolve(shipName);
            return;
          } else {
            console.log(shipId + ' was not found. Check the ID and try again.');
            reject(shipId + ' was not found. Check the ID and try again.');
            return;
          }          
        });
      });
    }, shipId);
  };

  // queries WG API for WoWS player stats
  // limited amoutn of requests/second
  module.wgStats = function(playerId, shipId) {
    return wgApiLimiter.schedule((playerId, shipId) => {
      return new Promise((resolve, reject) => {
        if(playerId === undefined) {
          reject('Player ID is empty!');
        } else if(playerId === undefined) {
          reject('Ship ID is empty!');
        }

        // define API params
        let shipStatsApi = 'ships/stats/';
        let accountParam = '&account_id=' + playerId;
        let fieldsParam = '&fields=pvp.battles, pvp.wins, pvp.damage_dealt, pvp.xp, pvp.survived_battles, pvp.frags, pvp.planes_killed';
        let shipParam = '';
        if(shipId !== undefined) {
          shipParam = '&ship_id=' + shipId;
        }

        request.get(
            wargamingApiUrl + shipStatsApi + wargamingApiId + accountParam + shipParam + fieldsParam, 
            (error, response, body) => {
          if(error) {
            console.log('Error while contacting WG API: ' + error);
            reject('Error while contacting WG API: ' + error);
            return;
          }

          let jsonBody = JSON.parse(body);
          if(jsonBody.status === 'error') {
            console.log('WG API returned the following error: ' + jsonBody.error);
            reject('WG API returned the following error: ' + jsonBody.error);
            return;
          }

          if(jsonBody.meta.hidden !== null) { // hidden stats
            console.log('Got player stats for ' + playerId + '!');
            resolve('Profile hidden.');
            return;
          } else if(jsonBody.data[playerId] === null) { // first battle
            console.log('Got player stats for ' + playerId + '!');
            resolve('First game, or this player does not own this ship.');
            return;
          }

          let dataArray = jsonBody.data[playerId];
          let pvpStats = dataArray[0].pvp;
          
          // calculate needed data
          let kdTmp; // check for divide by 0
          if(pvpStats.battles - pvpStats.survived_battles === 0) {
            kdTmp = 'inf';
          } else {
            kdTmp = pvpStats.frags / (pvpStats.battles - pvpStats.survived_battles);
          }

          let stats = {
            totalBattles: pvpStats.battles,
            winRate: (pvpStats.wins / pvpStats.battles) * 100,
            avgDmg: pvpStats.damage_dealt / pvpStats.battles,
            avgXp: pvpStats.xp / pvpStats.battles,
            survivalRate: (pvpStats.survived_battles / pvpStats.battles) * 100,
            avgKills: pvpStats.frags / pvpStats.battles,
            avgPlaneKills: pvpStats.planes_killed / pvpStats.battles,
            kd: kdTmp
          };

          console.log('Got player stats for ' + playerId + '!');
          resolve(stats);
          return;
        });
      });
    }, playerId, shipId);
  };

  // format stats into something readable
  module.formatStats = function(stats, playerName, shipName) {
    if(typeof stats === 'string') { // hidden or some kind of error
      return '**' + playerName + '**: *' + shipName + '*\n' + stats;
    } else { // JSON
      let msg = '**' + playerName + '**: *' + shipName + '*\n' +
                'Battles: ' + stats.totalBattles + '\n' +
                'Win Rate: ' + stats.winRate.toFixed(2) + '%\n' +
                'Average XP: ' + stats.avgXp.toFixed(0) + '\n' +
                'Average Damage: ' + stats.avgDmg.toFixed(0) + '\n' +
                'Survival Rate: ' + stats.survivalRate.toFixed(2) + '%\n' +
                'Average Plane Kills: ' + stats.avgPlaneKills.toFixed(2) + '\n' +
                'Average Kills: ' + stats.avgKills.toFixed(2) + '\n';
      if(typeof stats.kd === 'string') {
        msg += 'KD: ' + stats.kd + '\n';
      } else {
        msg += 'KD: ' + stats.kd.toFixed(2) + '\n';
      }

      return msg;
    }
  };

  // pass through wrapper needed to maintain variables within for loop
  function wgSearchPlayerIdWrapper(playerInfo) {
    return new Promise((resolve, reject) => {
      module.wgSearchPlayerId(playerInfo.name)
        .then((playerId) => {
          resolve([playerInfo, playerId]);
        })
        .catch((rejectReason) => {
          reject([playerInfo, rejectReason]);
        });
    });
  }

  // used for array sorting
  function caseInsensitiveCompare(string1, string2) {
    var s1lower = string1.toLowerCase();
    var s2lower = string2.toLowerCase();

    if(s1lower < s2lower) {
      return -1;
    } else if(s1lower > s2lower) {
      return 1;
    } else {
      return 0;
    }
  }

  // run when match start is detected
  // reads the tempArenaInfo.json file that is created by wows
  function processMatch(path) {
    let hrStart = process.hrtime();

    console.log('Loading file ' + path + '...');
    wowsChannel.send('Detected a match! Loading player stats...');

    // parse json and build team arrays
    arenaJson = require(arenaJsonPath); // blocking operation, but we need to wait anyways
    friendlyMsg = [];
    enemyMsg = [];
    let playerAmount = arenaJson.vehicles.length;
    for(let vehicleIndex in arenaJson.vehicles) {
      if(!arenaJson.vehicles.hasOwnProperty(vehicleIndex)) {
        continue;
      }

      let player = arenaJson.vehicles[vehicleIndex];

      // get ID by name
      wgSearchPlayerIdWrapper(player)
        .then((searchResult) => {
          let playerInfo = searchResult[0];
          let playerId = searchResult[1];

          module.wgStats(playerId, playerInfo.shipId)
            .then((stats) => {

              module.wgSearchShipName(playerInfo.shipId)
                .then((shipName) => {
                  let msg = module.formatStats(stats, playerInfo.name, shipName);
                  if(playerInfo.relation === 0 || playerInfo.relation === 1) {
                    friendlyMsg.push(msg);
                  } else {
                    enemyMsg.push(msg);
                  }

                  if(friendlyMsg.length === playerAmount / 2 && enemyMsg.length === playerAmount / 2) {
                    friendlyMsg.sort((string1, string2) => caseInsensitiveCompare(string1, string2));
                    enemyMsg.sort((string1, string2) => caseInsensitiveCompare(string1, string2));

                    wowsChannel.send('.\nFriendly Team\n====================');
                    for(let friendlyIndex in friendlyMsg) {
                      if(!friendlyMsg.hasOwnProperty(friendlyIndex)) {
                        continue;
                      }
                      wowsChannel.send(friendlyMsg[friendlyIndex]);
                    }

                    wowsChannel.send('.\nEnemy Team\n====================');
                    for(let enemyIndex in enemyMsg) {
                      if(!enemyMsg.hasOwnProperty(enemyIndex)) {
                        continue;
                      }
                      wowsChannel.send(enemyMsg[enemyIndex]);
                    }

                    let hrEnd = process.hrtime(hrStart);
                    console.log('It took ' + hrEnd[0] + ' seconds to load all stats.\n');
                  }
              });
          });
        });
    }
  }

  // inits the vars
  function initBot() {
    // make sure WG API requests/second limit was set
    if(process.env.WG_MAX_REQUESTS === undefined || process.env.WG_MAX_REQUESTS === '') {
      throw new Error('WG_MAX_REQUESTS not set!');
    }
    wgApiLimiter = new Bottleneck(1, 1000 / parseInt(process.env.WG_MAX_REQUESTS, 10));

    // make sure replay directory was set
    if(process.env.WOWS_REPLAY_FOLDER === undefined || process.env.WOWS_REPLAY_FOLDER === '') {
      throw new Error('WOWS_REPLAY_FOLDER was not set!');
    } else if (!fs.existsSync(process.env.WOWS_REPLAY_FOLDER)) { // make sure directory is valid
      throw new Error('The directory WOWS_REPLAY_FOLDER does not exist! ' + 
          'Make sure replays are enabled and/or the replays folder exists.');
    }
    arenaJsonPath = process.env.WOWS_REPLAY_FOLDER + 'tempArenaInfo.json';

    // make sure discord channel was set 
    if(process.env.DEFAULT_WOWS_CHANNEL === undefined || process.env.DEFAULT_WOWS_CHANNEL === '') {
      throw new Error('DEFAULT_WOWS_CHANNEL was not set!');
    }
    wowsChannel = client.channels.find('name', process.env.DEFAULT_WOWS_CHANNEL);

    // init API URLs
    switch(process.env.WOWS_REGION) {
      case 'na':
        wargamingApiUrl = 'https://api.worldofwarships.com/wows/';
        break;
      case 'eu':
        wargamingApiUrl = 'https://api.worldofwarships.eu/wows/';
        break;
      case 'ru':
        wargamingApiUrl = 'https://api.worldofwarships.ru/wows/';
        break;
      case 'asia':
        wargamingApiUrl = 'https://api.worldofwarships.asia/wows/';
        break;
      default:
        throw new Error('Invalid WOWS_REGION or not set! It should be "na", "eu", "ru", or "asia", without quotes.');
        // no break needed
    }

    if(process.env.WG_API_ID === undefined || process.env.WG_API_ID === '') {
      throw new Error('WG_API_ID was not set!');
    }
    wargamingApiId = '?application_id=' + process.env.WG_API_ID;
  }
  initBot();

  // watch for tempArenaInfo.json with player info created by wows
  let watcher = chokidar.watch(arenaJsonPath, {
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  watcher.on('add', (path) => processMatch(path));

  // ----- chat commands -----

  // !wgstats [account name] [ship name] will query stats for that player and ship
  client.on('message', (msg) => {
    let msgContent = msg.content;
    if(msgContent.substring(0, 8) !== '!wgstats') {
      return;
    }

    let channel = msg.channel;
    let msgArray = msgContent.split(' ');

    if(msgArray.length < 3) { // missing args
      channel.send('**Command failed:** Invalid command format!\n' + 
          'The command is `!wgstats [account name] [ship name]`.');
      return;
    } else if(msgArray.legnth > 3) { // too many
      channel.send('**Command warning:** Too many arguments.\n' +
         'Assuming first argument is account name and the second argument is ship mame.');
    }

    let playerName = msgArray[1];
    let playerId;
    let shipName = msgArray[2];
    let shipId;

    module.wgSearchPlayerId(playerName)
      .then((tmpPlayerId) => {
        playerId = tmpPlayerId;
        return module.wgSearchShipId(shipName);
      })
      .then((tmpShipId) => {
        shipId = tmpShipId;
        return module.wgStats(playerId, shipId);
      })
      .then((stats) => {
        let msg = module.formatStats(stats, playerName, shipName);
        channel.send(msg);
        return;
      })
      .catch((rejectReason) => {
        channel.send('**Command failed:** ' + rejectReason);
        return;
      });
  });
};

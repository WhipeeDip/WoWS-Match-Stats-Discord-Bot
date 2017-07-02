/*
 * File name: wg_api.js
 * Description: Contains functions to interact with the Wargaming API.
 */

let Promise = require('bluebird');
let Bottleneck = require('bottleneck');
let request = require('request');

// contains the WG API functions
// require this
module.exports = function() {
  let module = {}; // the module
  let wgApiLimiter; // bottleneck for WG API requests
  let wargamingApiUrl; // region specific API URL for wargaming
  let wargamingApiId; // paramter with wargaming API application ID

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
            console.log('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
            reject('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
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
            console.log('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
            reject('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
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
            console.log('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
            reject('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
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
            console.log('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
            reject('WG API returned the following error: ' + jsonBody.error['code'] + ' ' + jsonBody.error['message']);
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

  // pass through wrapper needed to maintain variables within for loop
  module.wgSearchPlayerIdWrapper = function(playerInfo) {
    return new Promise((resolve, reject) => {
      module.wgSearchPlayerId(playerInfo.name)
        .then((playerId) => {
          resolve([playerInfo, playerId]);
        })
        .catch((rejectReason) => {
          reject([playerInfo, rejectReason]);
        });
    });
  };

  // init bot
  function initWgApis() {
    // make sure WG API requests/second limit was set
    if(process.env.WG_MAX_REQUESTS === undefined || process.env.WG_MAX_REQUESTS === '') {
      throw new Error('WG_MAX_REQUESTS not set!');
    }
    wgApiLimiter = new Bottleneck(1, 1000 / parseInt(process.env.WG_MAX_REQUESTS, 10));

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
  };
  initWgApis();

  return module;
};
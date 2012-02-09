var uniqueid = require('./uniqueid');
var mongodb = require('../node_modules/mongodb');

var World = function() {
    this.terrain = {};
    this.time = 0;
    this.onlineplayers = 0;
    this.maxplayers = 50;
    this.players = [];
    this.sessions = [];
    this.uidgen = new uniqueid.UniqueIDGenerator();
    this.entities = {};
}

World.prototype.spawn_for_harvest = {
	1: 4, // Stone -> cobblestone
	2: 3, // Grass -> dirt
	3: 3, // Dirt  -> dirt
	4: 4, // Cobblestone -> cobblestone
	5: 5, // Wood -> Wood
	6: 6, // Sapling->Sapling
	12: 12, // Sand->Sand
	13: 13, // Gravel->Gravel
	14: 14, // Gold Ore->Gold Ore
	15: 15, // Iron Ore->Iron Ore
	16: 263, // Coal Ore -> Coal
	17: 17, // Logs -> Logs
	37: 37, // Flower->Flower
	38: 38, // Flower->Flower
	39: 39, // Mushroom->Mushroom
	40: 40, // Mushroom->Mushroom
};

exports.World = World;
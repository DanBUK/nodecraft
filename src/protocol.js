var sys = require('util');
var pack = require('jspack').jspack;
var helpers = require('./helpers');

Packet = function (data) {
	this.type = data[0];
	this.data = data;
	this.cursor = 1;
}

Packet.prototype.needs = function (nBytes) {
	if (this.data.length - this.cursor < nBytes) {
		throw Error("oob");
	}
}

var packString = function (str) {
	var buf = new Buffer(str.length * 2);
	for (var i = 0; i < str.length; i++){
		makers['short'](str.charCodeAt(i)).copy(buf, i * 2);
	}
	return helpers.concat(makers['short'](str.length), buf);
}
var unpackString = function (pkt) {
	var len = parsers.short(pkt) * 2;
	pkt.needs(len);
	var buffer = pkt.data.slice(pkt.cursor, pkt.cursor + len);
	var str = "";
	for(var i = 0; i < buffer.length; i+=2){
		str+= String.fromCharCode((buffer[i]<<8) + buffer[i+1]);
	}
	pkt.cursor += len;
	return str;
}
var packIntString = function (str) {
	if (!(str instanceof Buffer)) str = new Buffer(str);
	return helpers.concat(makers['int'](str.length), str);
}
var unpackIntString = function (pkt) {
	var len = parsers.int(pkt);
	pkt.needs(len);
	var str = pkt.data.slice(pkt.cursor, pkt.cursor + len);
	pkt.cursor += len;
	return str;
}

var packBlockArr = function (blks) {
	var buf = makers.short(blks.length);
	var coordArr = new Buffer(0);
	var typeArr = new Buffer(0);
	var metadataArr = new Buffer(0);
	blks.forEach(function (b) {
		var coord = ((b.x & 0xf) << 12) | ((b.z & 0xf) << 8) | (b.y & 0xff);
		coordArr = helpers.concat(coordArr, makers.short(coord));
		typeArr = helpers.concat(typeArr, makers.byte(b.type));
		metadataArr = helpers.concat(metadataArr, makers.byte(b.metadata));
	});

	return helpers.concat(buf, coordArr, typeArr, metadataArr);
}
var unpackBlockArr = function (pkt) {
	var len = parsers.short(pkt);
	var blks = [];
	for (var i = 0; i < len; i++) {
		var coord = parsers.short(pkt);
		var x = (coord & 0xf000) >> 12;
		var z = (coord & 0xf00) >> 8;
		var y = (coord & 0xff);
		blks.push({
			x: x,
			z: z,
			y: y
		});
	}
	for (var i = 0; i < len; i++) {
		blks[i].type = parsers.byte(pkt);
	}
	for (var i = 0; i < len; i++) {
		blks[i].metadata = parsers.byte(pkt);
	}
	return blks;
}

var unpackBool = function (pkt) {
	pkt.needs(1);
	var ret = pkt.data[pkt.cursor] != 0;
	pkt.cursor += 1;
	return ret;
}

var packBool = function (bool) {
	return new Buffer([bool ? 1 : 0]);
}


var packItems = function (items) {
	var buf = makers['short'](items.length);
	for (var i = 0; i < items.length; i++) {
		buf = helpers.concat(buf, makers['short'](items[i].id));
		if (items[i].id != -1) {
			buf = helpers.concat(buf, makers['byte'](items[i].count));
			buf = helpers.concat(buf, makers['short'](items[i].health));
		}
	}
	return buf;
}

var unpackMultiBlocks = function (pkt) {
	var blocks = [];
	var numBlocks = parsers.short(pkt);
	for (var i = 0; i < numBlocks; i++) {
		coord = parsers.short(pkt);
		blocks.push({
			x: (coord >> 12),
			z: ((coord >> 8) & 0xF),
			y: (coord & 0xFF)
		})
	}
	for (var i = 0; i < numBlocks; i++)
	blocks[i].type = parsers.byte(pkt);

	for (var i = 0; i < numBlocks; i++)
	blocks[i].meta = parsers.byte(pkt);

	return blocks;
}

var unpackItems = function (pkt) {
	var items = [];
	var numItems = parsers.short(pkt);
	for (var i = 0; i < numItems; i++) {
		var id = parsers.short(pkt),
			count, health;
		if (id != -1) {
			count = parsers.byte(pkt);
			health = parsers.short(pkt);
		}
		items.push({
			id: id,
			count: count,
			health: health
		});
	}
	return items;
}

var packSlot = function (slot) {
    var buf = new Buffer(0);
	buf = helpers.concat(buf, makers['short'](slot.itemId));
	if (slot.itemId != -1) {
		buf = helpers.concat(buf, makers['byte'](slot.count));
		buf = helpers.concat(buf, makers['short'](slot.damage));
	}
    
    return buf;
}

var unpackSlot = function (pkt) {
    var itemId = parsers.short(pkt), count, damage;
	if (itemId != -1) {
        count = parsers.byte(pkt);
		damage = parsers.short(pkt);
    }
    
    return {
		itemId: itemId,
		count: count,
		damage: damage
		};
}

function byte(name) {
	return ['byte', name];
}

function ubyte(name) {
	return ['ubyte', name];
}

function short(name) {
	return ['short', name];
}
// ToDo: Add ushort type
function ushort(name) {
	return ['short', name];
}

function int(name) {
	return ['int', name];
}

function long(name) {
	return ['long', name];
}

function str(name) {
	return ['str', name];
}

function bool(name) {
	return ['bool', name];
}

function double(name) {
	return ['double', name];
}

function float(name) {
	return ['float', name];
}

function items(name) {
	return ['items', name];
}

function multiblock(name) {
	return ['multiblock', name];
}

function intstr(name) {
	return ['intstr', name];
}

function blockarr(name) {
	return ['blockarr', name];
}

function slot(name) {
	return ['slot', name];
}
// ToDo add metadata type
function metadata(name) {
	return ['byte', name];
}

var clientPacketStructure = {
	0x00: [int('pingID')],
	0x01: [int('protoVer'), str('username'), str('mapSeed'), int('serverMode'), int('dimension'), byte('difficulty'), ubyte('height'), ubyte('slots')],
	0x02: [str('username')],
	0x03: [str('message')],
	// 0x05: [int('invType'), items('items')],
	0x05: [int('entityID'), short('slot'), short('itemID'), short('damage')],
	0x07: [int('playerId'), int('targetId'), bool('isLeftClick')],
	0x09: [byte('dimension'), byte('difficulty'), byte('gameMode'), short('worldHeight'), str('mapSeed')],
    0x0a: [bool('onGround')],
	0x0b: [double('x'), double('y'), double('stance'), double('z'), bool('onGround')],
	0x0c: [float('yaw'), float('pitch'), bool('onGround')],
	0x0d: [double('x'), double('y'), double('stance'), double('z'), float('yaw'), float('pitch'), bool('onGround')],
	0x0e: [byte('status'), int('x'), byte('y'), int('z'), byte('face')],
	0x0f: [int('x'), byte('y'), int('z'), byte('direction'), slot('slot')],
	0x10: [short('newSlot')],
	0x12: [int('uid'), byte('animation')],
	0x13: [int('uid'), byte('actionId')],
	0x15: [int('uid'), short('item'), byte('amount'), short('life'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), byte('roll')],
	0x65: [byte('windowId')],
	0x66: [byte('windowId'), short('slot'), byte('rightClick'), short('actionNumber'), bool('shift'), slot('slot')],
	0x6a: [byte('windowId'), short('actionNumber'), bool('accepted')],
	0x6b: [short('slot'), slot('clicked')],
	0x6c: [byte('windowId'), byte('enchantment')],
	0x82: [int('x'), short('y'), int('z'), str('text1'), str('text2'), str('text3'), str('text4')],
//	0xfa: [str('channel'), short('length'), bytearr('byteArray')],
	0xfe: [],
	0xff: [str('message')],
}

var serverPacketStructure = {
	0x00: [int('pingID')],
	0x01: [int('playerID'), str('serverName'), str('mapSeed'), int('serverMode'), int('dimension'), byte('difficulty'), ubyte('height'), ubyte('maxPlayers')],
	0x02: [str('serverID')],
	0x03: [str('message')],
	0x04: [long('time')],
	// 0x05: [int('invType'), items('items')],
	0x05: [int('entityID'), short('slot'), short('itemID'), short('damage')],
	0x06: [int('x'), int('y'), int('z')],
	0x08: [short('health'), short('food'), float('foodSat')],
	0x09: [byte('dimension'), byte('difficulty'), byte('gameMode'), short('worldHeight'), str('mapSeed')],
	0x0a: [bool('onGround')],
	0x0b: [double('x'), double('y'), double('stance'), double('z'), bool('onGround')],
	0x0c: [float('yaw'), float('pitch'), bool('onground')],
	0x0d: [double('x'), double('stance'), double('y'), double('z'), float('yaw'), float('pitch'), bool('onGround')],
	//0x0e: [byte('status'), int('x'), byte('y'), int('z'), byte('face')],
	//0x0f: [short('id'), int('x'), byte('y'), int('z'), byte('direction')],
	0x10: [int('uid'), short('item')],
	0x11: [short('itemId'), byte('inBed'), int('x'), byte('y'), int('z')],
	0x12: [int('uid'), byte('animation')],
	0x13: [int('uid'), byte('actionId')],
	0x14: [int('uid'), str('playerName'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), short('curItem')],
	0x15: [int('uid'), short('item'), byte('amount'), short('life'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), byte('roll')],
	0x16: [int('collectedID'), int('collectorID')],
	0x17: [int('uid'), byte('objType'), int('x'), int('y'), int('z'), int('fireballerId')],
	0x18: [int('uid'), byte('mobType'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), byte('headYaw'), metadata('metadata') ],
	0x19: [int('uid'), str('title'), int('x'), int('y'), int('z'), int('direction')],
	0x1a: [int('uid'), int('x'), int('y'), int('z'), short('count')],
	0x1c: [int('uid'), short('velocityX'), short('velocityY'), short('velocityZ')],
	0x1d: [int('uid')],
	0x1e: [int('uid')],
	0x1f: [int('uid'), byte('x'), byte('y'), byte('z')],
	0x20: [int('uid'), byte('yaw'), byte('pitch')],
	0x21: [int('uid'), byte('x'), byte('y'), byte('z'), byte('yaw'), byte('pitch')],
	0x22: [int('uid'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch')],
	0x23: [int('uid'), byte('headYaw')],
	0x26: [int('uid'), byte('status')],
	0x27: [int('uid'), int('vechicleId')],
	0x28: [int('uid'), metadata('metadata')],
	0x29: [int('uid'), byte('effect'), byte('amplifer'), short('duration')],
	0x2a: [int('uid'), byte('effect')],
	0x2b: [float('xpBar'), short('level'), short('xpTotal')],
	0x32: [int('x'), int('z'), bool('mode')],
	// prechunk
	0x33: [int('x'), int('z'), bool('continuous'), ushort('primaryBit'), ushort('addBitMap'), int('chunkSize'), int('unused'), intstr('chunk')],
	// map chunk, gzipped
	0x34: [int('x'), int('z'), short('count'), multiblock('blocks')],
	// multi block change
	0x35: [int('x'), byte('y'), int('z'), byte('blockType'), byte('blockMetadata')],
	0x36: [int('x'), short('y'), int('z'), byte('byte1'), byte('byte2')],
//	0x3b: [int('x'), short('y'), int('z'), str('nbt')], // Removed
//	0x3c: [double('x'), double('y'), double('z'), float('radius'), int('recordCount'), records('records')],
	0x3d: [int('uid'), int('x'), byte('y'), int('z'), int('data')],
	0x46: [byte('reason'), byte('mode')],
	0x47: [int('uid'), bool('unknown'), int('x'), int('y'), int('z')],
	0x64: [byte('windowId'), byte('invType'), str('title'), byte('slots')],
	0x65: [byte('windowId')],
	0x67: [byte('windowId'), short('slotId'), slot('slotData')],
	0x68: [byte('windowId'), short('count'), intstr('blocks')],
	0x69: [byte('windowId'), short('property'), short('value')],
	0x6a: [byte('windowId'), short('actionNumber'), bool('accepted')],
	0x6b: [short('slot'), slot('clicked')],
	0x82: [int('x'), short('y'), int('z'), str('text1'), str('text2'), str('text3'), str('text4')],
//	0x83: [short('itemType'), short('itemId'), ubyte('textLength'), bytearr('byteArray')],
	0x84: [int('x'), short('y'), int('z'), byte('action'), int('custom1'), int('custom2'), int('custom3')],
	0xc8: [int('statID'), byte('amount')],
	0xc9: [str('username'), bool('online'), short('ping')],
//	0xfa: [str('channel'), short('length'), bytearr('byteArray')],
	0xff: [str('message')]
	// disconnect
}

var packetNames = {
	0x00: 'KEEPALIVE',
	0x01: 'LOGIN',
	0x02: 'HANDSHAKE',
	0x03: 'CHAT',
	0x04: 'TIME',
	0x05: 'ENTITY_EQUIPMENT',
	0x06: 'SPAWN_POS',
	0x07: 'ENTITY_USE',
	0x08: 'HEALTH_UPDATE',
	0x09: 'RESPAWN',
	0x0a: 'PLAYER',
	0x0b: 'PLAYER_POSITION',
	0x0c: 'PLAYER_LOOK',
	0x0d: 'PLAYER_MOVE_LOOK',
	0x0e: 'BLOCK_DIG',
	0x0f: 'BLOCK_PLACE',
	0x10: 'ITEM_HOLDING',
	0x11: 'BED_USE',
	0x12: 'ANIMATION',
	0x13: 'ENTITY_ACTION',
	0x14: 'PLAYER_SPAWN',
	0x15: 'PICKUP_SPAWN',
	0x16: 'ITEM_COLLECT',
	0x17: 'VEHICLE_SPAWN',
	0x18: 'MOB_SPAWN',
	0x19: 'PAINTING_SPAWN',
	0x1a: 'ORB_SPAWN',
	0x1c: 'ENTITY_VELOCITY',
	0x1d: 'ENTITY_DESTROY',
	0x1e: 'ENTITY_CREATE',
	0x1f: 'ENTITY_RELMOVE',
	0x20: 'ENTITY_LOOK',
	0x21: 'ENTITY_RELMOVE_LOOK',
	0x22: 'ENTITY_TELEPORT',
	0x23: 'ENTITY_HEADLOOK',
	0x26: 'ENTITY_STATUS',
	0x27: 'ENTITY_ATTACH',
	0x28: 'ENTITY_METADATA',
	0x29: 'ENTITY_EFFECT',
	0x2a: 'ENTITY_EFFECT_REMOVE',
	0x2b: 'XP_SET',
	0x32: 'MAP_ALLOCATE',
	0x33: 'MAP_CHUNKS',
	0x34: 'MULTI_BLOCK_CHANGE',
	0x35: 'BLOCK_CHANGE',
	0x36: 'BLOCK_ACTION',
//	0x3b: 'NBT_ENTITY', //Removed
	0x3c: 'EXPLOSION',
	0x3d: 'SOUNDPARTICLE_EFFECT',
	0x46: 'GAMESTATE_CHANGE',
	0x47: 'THUNDERBOLT',
	0x64: 'WINDOW_OPEN'
	0x65: 'WINDOW_CLOSE',
	0x66: 'WINDOW_CLICK',
	0x67: 'SLOT_SET',
	0x68: 'WINDOW_ITEMS',
	0x69: 'WINDOW_PROPERTY_UPDATE',
	0x6a: 'TRANSACTION_CONFIRM',
	0x6b: 'INVENTORY_ACTION',
	0x6c: 'WINDOW_ITEM_ENCHANT',
	0x82: 'SIGN_UPDATE',
	0x83: 'ITEM_DATA',
	0x84: 'TILE_ENTITY_UPDATE',
	0xc8: 'STAT_INC',
	0xc9: 'PLAYERLIST_ITEM',
	0xfa: 'PLUGIN_MESSAGE',
	0xfe: 'SERVER_LIST_PING',
	0xff: 'DISCONNECT',
}

function unpack_fmt(fmt) {
	return function (pkt) {
		var len = pack.CalcLength(fmt);
		pkt.needs(len);
		var value = pack.Unpack(fmt, pkt.data, pkt.cursor);
		pkt.cursor += len;
		return value[0];
	};
}

function pack_fmt(fmt) {
	return function () {
		return new Buffer(pack.Pack(fmt, arguments));
	}
}

var parsers = {
	byte: unpack_fmt('b'),
	ubyte: unpack_fmt('B'),
	short: unpack_fmt('h'),
	int: unpack_fmt('i'),
	long: unpack_fmt('l'),
	str: unpackString,
	bool: unpackBool,
	float: unpack_fmt('f'),
	double: unpack_fmt('d'),
	multiblock: unpackMultiBlocks,
	items: unpackItems,
	intstr: unpackIntString,
	blockarr: unpackBlockArr,
    slot: unpackSlot,
}

var makers = {
	byte: pack_fmt('b'),
	ubyte: pack_fmt('B'),
	short: pack_fmt('h'),
	int: pack_fmt('i'),
	long: pack_fmt('l'),
	str: packString,
	bool: packBool,
	float: pack_fmt('f'),
	double: pack_fmt('d'),
	items: packItems,
	intstr: packIntString,
	blockarr: packBlockArr,
    slot: packSlot,
}

exports.parsePacket = function (buf) {
	return exports.parsePacketWith(buf, clientPacketStructure);
}

exports.parsePacketWith = function (buf, structures) {
	var pkt = new Packet(buf);
	var struct = structures[pkt.type];
	if (!struct) throw Error("unknown packet type while parsing: 0x" + pkt.type.toString(16));
	var pktData = {
		type: pkt.type
	};
	for (var field in struct) {
		var type = struct[field][0];
		var name = struct[field][1];
		pktData[name] = parsers[type](pkt);
	}
	pktData.length = pkt.cursor;
	return pktData;
}

exports.makePacket = function (pktData) {
	return exports.makePacketWith(pktData, serverPacketStructure);
}

exports.makePacketWith = function (pktData, structures) {
	var struct = structures[pktData.type];
	if (!struct) throw Error("unknown packet type while making: 0x" + pkt.type.toString(16));
	var buf = new Buffer([pktData.type]);
	for (var field in struct) {
		var type = struct[field][0];
		var name = struct[field][1];
		buf = helpers.concat(buf, makers[type](pktData[name]));
	}
	return buf;
}

exports.clientPacketStructure = clientPacketStructure;
exports.serverPacketStructure = serverPacketStructure;
exports.packetNames = packetNames;

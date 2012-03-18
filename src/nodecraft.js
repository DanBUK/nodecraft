var sys = require('util'),
	net = require('net'),
	colors = require('colors'),
	zip = require('zlib'),
	fs = require('fs'),
	ps = require('./protocol'),
	chunk = require('./chunk'),
	session = require('./session'),
	terrain = require('./terrain'),
	entities = require('./entities'),
	world = require('./world'),
	player = require('./player'),
	helpers = require('./helpers');
var enableProtocolDebug = 1;
var enableChunkPreDebug = 0;
var enableTerrainModsDebug = 0;
var hideCommonPackets = true;

function protodebug() {
	if (enableProtocolDebug) {
		sys.debug.apply(sys, arguments);
	}
}

function chunkpredebug() {
	if (enableChunkPreDebug) {
		sys.debug.apply(sys, arguments);
	}
}

function terrainmodsdebug() {
	if (enableTerrainModsDebug) {
		sys.debug.apply(sys, arguments);
	}
}

function keepalive(session, pkt) {
	// doo-de-doo
}

function handshake(session, pkt) {
	session.stream.write(ps.makePacket({
		type: 0x02,
		serverID: '-'
	}));
}

function composeTerrainPacket(cb, session, x, z) {
	var zippedChunk = new Buffer(0),
		gzip = zip.createDeflate({
			level: zip.Z_DEFAULT_COMPRESSION,
			windowBits: zip.MAX_WBITS
		}),
		primaryBit = 0;
	gzip.on('data', function (data) {
		zippedChunk = helpers.concat(zippedChunk, data);
	}).on('error', function (err) {
		throw err;
	}).on('end', function () {
		chunkpredebug("X: " + x + " Z: " + z);
		session.stream.write(ps.makePacket({
			type: 0x33,
			x: x,
			z: z,
//			y: 0,
			continuous: true,
			primaryBit: primaryBitMask,
			addBitMap: 0,
			chunkSize: zippedChunk.length,
//			sizeX: 15,
//			sizeY: 127,
//			sizeZ: 15,
			unused: 0,
			// +1 to all
			chunk: zippedChunk
		}));
		cb();
	});
	session.world.terrain.getChunk(x, z, function (chunk_data) {
		primaryBitMask = chunk_data.mask;
		gzip.write(chunk_data.data);
		gzip.end();
	});
}

var y = function(a){return Object.getOwnPropertyNames(a).filter(function(b){return"function"==typeof a[b]})};

function sendPacketToAllPlayers(pkt) {
	console.log(world.players);
	for (var q = 0; q < world.players.length; q++) {
		//console.log(world.players[q].session.stream);
		if (!world.players[q].session.stream._handle) { throw new Error('closed socket?'); continue; }
		console.log(y(world.players[q].session.stream));
		world.players[q].session.stream._handle.socket.write(pkt);
		//world.players[q].session.stream.send(pkt);
	}
}

function sendPacketToOtherPlayers(pkt, myEid) {
	for (var q = 0; q < world.players.length; q++) {
		if (world.players[q].session.uid != myEid) {
			console.log(y(world.players[q].session.stream));
			world.players[q].session.stream._handle.socket.write(pkt);
		}
	}
}

function login(session, pkt) {
	sys.print("Protocol version: " + pkt.protoVer + "\nUsername: " + pkt.username + "\n");
	session.username = pkt.username; /* TODO: Add whitelist check here */
	// TODO: Validate user against minecraft.net
	session.stream.write(ps.makePacket({
		type: 0x01,
		playerID: world.uidgen.allocate(),
		serverName: '',
		levelType: 'DEFAULT',
		serverMode: 0,
		//TODO: Survival vs Creative
		dimension: 0,
		difficulty: 0,
		height: 128,
		maxPlayers: world.maxplayers //TODO: Actually limit amount of players
	}));
	sendPacketToAllPlayers(ps.makePacket({
		type: 0x03,
		message: pkt.username + ' joined the game'
	}));
	// i'm going to send you some chunks!
	var zBuf = new Buffer(0);
	for (var x = -10; x < 10; x++) {
		for (var z = -10; z < 10; z++) {
			var buf = ps.makePacket({
				type: 0x32,
				mode: true,
				x: x,
				z: z
			});
			zBuf = helpers.concat(zBuf, buf);
		}
	}
	session.stream.write(zBuf); /* Fast start */
	for (var x = -3 * 16; x < 3 * 16; x += 16) {
		for (var z = -3 * 16; z < 3 * 16; z += 16) { /* Closure for callback [cannot do anonymously, otherwise we end up with 160,160] */
			r = function (x, z) { /* Callback to be added to outgoing session task list */
				return function (cb) {
					composeTerrainPacket(cb, session, x, z);
				}
			}
			session.world.terrain.recalculateLighting(x, z, function () {
				session.addOutgoing(r(x, z));
			});
		}
	}
	session.stream.write(ps.makePacket({
		type: 0x06,
		x: 0,
		y: 65,
		z: 0
	}));
	get_and_send_position = function (cb) {
		send_position_packet = function (posY) {
			session.stream.write(ps.makePacket({
				type: 0x0d,
				x: 0,
				y: posY + 1,
				z: 0,
				stance: 71,
				yaw: 0,
				pitch: 0,
				flying: 0,
			}));
			cb();
		};
		session.world.terrain.getMaxHeight(0, 0, send_position_packet);
	};
	session.addOutgoing(get_and_send_position); /* Send rest of packets in visible range */
	for (var x = -10 * 16; x < 10 * 16; x += 16) {
		for (var z = -10 * 16; z < 10 * 16; z += 16) {
			if ((x == -16 || x == 0) && (z == -16 || z == 0)) continue; /* Closure for callback [cannot do anonymously, otherwise we end up with 160,160 */
			r = function (x, z) { /* Callback to be added to outgoing session task list */
				return function (cb) {
					session.world.terrain.recalculateLighting(x, z, function () {
						composeTerrainPacket(cb, session, x, z);
					});
				}
			}
			session.addOutgoing(r(x, z));
		}
	}
	world.onlineplayers++;
	session.player = new player.Player(session);
	session.player.name = pkt.username;
	session.player.X = 0;
	session.player.Y = 62;
	session.player.Z = 0;
	session.player.yaw = 0;
	session.player.pitch = 0;
	world.players.push(session.player);
	//Send this player to everyone else
	var thisPlayer = ps.makePacket({
		type: 0x14,
		uid: session.uid,
		playerName: session.player.name,
		x: session.player.X * 32,
		y: session.player.Y * 32,
		z: session.player.Z * 32,
		yaw: session.player.yaw,
		pitch: session.player.pitch,
		curItem: 0
	});
	sendPacketToOtherPlayers(thisPlayer, session.uid);
	//Send other players to this one
	var playersBuf = new Buffer(0);
	for (var i = 0; i < world.players.length; i++) {
		if (world.players[i].session.uid != session.uid) {
			var p = ps.makePacket({
				type: 0x14,
				uid: world.players[i].session.uid,
				playerName: world.players[i].name,
				x: world.players[i].X * 32,
				y: world.players[i].Y * 32,
				z: world.players[i].Z * 32,
				yaw: world.players[i].yaw,
				pitch: world.players[i].pitch,
				curItem: 0
			});
			playersBuf = helpers.concat(playersBuf, p);
		}
	}
	if (playersBuf.length > 0) {
		session.stream.write(playersBuf);
	}
	session.pump();
}

function blockdig(session, pkt) {
	if (pkt.status == 0x2) {
		terrainmodsdebug("Received packet: " + sys.inspect(pkt)); /* Get the type that was there */
		session.world.terrain.getCellType(pkt.x, pkt.y, pkt.z, function (cellType) { /* Blank the cell */
			session.world.terrain.setCellType(pkt.x, pkt.y, pkt.z, 0x0); /* Reply with block dig notification */
			/* TODO: terrainSessionTracker should do this by listening to the chunk */
			sendPacketToAllPlayers(ps.makePacket({
				type: 0x35,
				x: pkt.x,
				y: pkt.y,
				z: pkt.z,
				blockType: 0,
				blockMetadata: 0
			})); /* Spawn an object to be picked up */
			if (cellType in world.spawn_for_harvest) {
				// Spawn the object
				var newEntity = world.entities.spawnEntity(pkt.x * 32 + 16, pkt.y * 32 + 16, pkt.z * 32 + 16, world.spawn_for_harvest[cellType], 0, 0, 0); /* TODO - this should be done by something listening on the EntityTracker */
				sendPacketToAllPlayers(ps.makePacket({
					type: 0x15,
					uid: newEntity.uid,
					item: newEntity.type,
					amount: 1,
					life: 0,
					//TODO: damage
					x: newEntity.x,
					y: newEntity.y,
					z: newEntity.z,
					yaw: newEntity.yaw,
					pitch: newEntity.pitch,
					roll: newEntity.velocity
				}));
			}
		});
	}
}

function blockplace(session, pkt) {
	if (pkt.x == -1 && pkt.y == -1 && pkt.z == -1 && pkt.direction == -1) {
		sys.debug("Player USING block " + pkt.x + " " + pkt.y + " " + pkt.z + " " + pkt.direction);
		return;
	}
	var coords = helpers.findBlockCoordsForDirection(pkt.x, pkt.y, pkt.z, pkt.direction);
	/* Check to ensure that we're building against a block that can't be "used"
	 * If we can "use" a block; the build event is sent to tell the server that we're using that block
	 */
	checkBlockEventHandler = function (type) {
		if (helpers.isUsableObject(type)) {
			return
		};
		if (pkt.slot.count >= 0) {
			session.world.terrain.setCellType(coords.x, coords.y, coords.z, pkt.slot.itemId);
			session.player.inventory[36]--; /* TODO: TerrainTracker should do this by listening on the chunk and updating all clients that have it when the change goes through */
			sendPacketToAllPlayers(ps.makePacket({
				type: 0x35,
				x: coords.x,
				y: coords.y,
				z: coords.z,
				blockType: pkt.slot.itemId,
				blockMetadata: 0
			}));
		}
	};
	session.world.terrain.getCellType(pkt.x, pkt.y, pkt.z, checkBlockEventHandler);
}

function flying(session, pkt) {}

function playerlook(session, pkt) {
	session.player.yaw = pkt.yaw;
	session.player.pitch = pkt.pitch;
	session.player.onGroup = pkt.onGround;
	sendPacketToOtherPlayers(ps.makePacket({
		type: 0x20,
		uid: session.uid,
		yaw: session.player.yaw,
		pitch: session.player.pitch,
	}), session.uid);
}

function animation(session, pkt) {}

function closewindow(session, pkt) {}

function windowclick(session, pkt) {}

function changeholding(session, pkt) {
	session.player.currentSlot = pkt.newSlot + 36;
}

function checkEntities(session, x, y, z) {
	var pickups = session.world.entities.findPickups(x * 32, y * 32, z * 32)
	blockBuffer = new Buffer(7 * pickups.length);
	for (var i = 0; i < pickups.length; i++) {
		var item = pickups[i]; /* TODO - this should be done by something listening on the EntityTracker */
		var pickupPacket = ps.makePacket({
			type: 0x16,
			collectedID: item.uid,
			collectorID: session.uid
		});
		session.stream.write(pickupPacket);
		// this buffer is formatted like this: http://mc.kev009.com/Slot_Data
		var pos = 7 * i;
		blockBuffer.writeInt16BE(item.type, pos, true); // the type
		blockBuffer.writeInt8(9, pos + 2, true); // where is quantity stored?
		blockBuffer.writeInt16BE(0, pos + 3, true); // damage/block metadata
		blockBuffer.writeInt16BE(-1, pos + 5, true); // no further data
		/* TODO - also should be done by something listening on the EntityTracker - destruction of an item
		 * on the server should push the notification to affected clients automatically, without having to do it in every case
		 * */
		sendPacketToAllPlayers(ps.makePacket({
			type: 0x1d,
			uid: item.uid
		}));
		session.world.entities.destroyEntity(item.uid);
		session.player.inventory[36].count++;
		session.stream.write(ps.makePacket({
			type: 0x67,
			windowId: 0,
			slotId: 36,
			itemId: 3,
			count: session.player.inventory[36].count,
			damage: 0
		}));
	}
}

function moveandlook(session, pkt) {
	checkEntities(session, pkt.x, pkt.y, pkt.z);
	var dX = pkt.x * 32 - session.player.X * 32;
	var dY = pkt.y * 32 - session.player.Y * 32;
	var dZ = pkt.z * 32 - session.player.Z * 32;
	session.player.X = pkt.x;
	session.player.Y = pkt.y;
	session.player.Z = pkt.z;
	session.player.stance = pkt.stance;
	session.player.yaw = pkt.yaw;
	session.player.pitch = pkt.pitch;
	session.player.onGroup = pkt.onGround;
	sendPacketToOtherPlayers(ps.makePacket({
		type: 0x21,
		uid: session.uid,
		x: dX,
		y: dY,
		z: dZ,
		yaw: pkt.yaw,
		pitch: pkt.pitch
	}), session.uid);
}

function playerpos(session, pkt) {
	checkEntities(session, pkt.x, pkt.y, pkt.z);
	var dX = 32 * pkt.x - 32 * session.player.X,
		dY = 32 * pkt.y - 32 * session.player.Y,
		dZ = 32 * pkt.z - 32 * session.player.Z;
	session.player.X = pkt.x;
	session.player.Y = pkt.y;
	session.player.Z = pkt.z;
	session.player.stance = pkt.stance;
	session.player.onGround = pkt.onGround;
	sendPacketToOtherPlayers(ps.makePacket({
		type: 31,
		uid: session.uid,
		x: dX,
		y: dY,
		z: dZ
	}), session.uid);
}

function grantID(session, type, count) {
	if (typeof (count) == undefined) {
		count = 1;
	}
	/*session.stream.write(ps.makePacket({
		type: 0x11,
		item: type,
		amount: count,
		life: 0
	}));*/
}

function chat(session, pkt) {
	if (pkt.message.indexOf("/grant") == 0) {
		var tokens = pkt.message.split(" ");
		sys.debug(sys.inspect(tokens));
		var count = 1;
		var item = parseInt(tokens[1]);
		if (typeof (tokens[2]) != undefined) {
			count = parseInt(tokens[2]);
		}
		grantID(session, item, count);
	}
}

function serverlistping(session, pkt) {
	session.stream.end(ps.makePacket({
		type: 0xff,
		message: 'A Nodecraft Server§' + world.onlineplayers + '§' + world.maxplayers
	}));
	session.closed = true;
}

function disconnect(session, pkt) {
	world.onlineplayers--;
	session.stream.end();
	session.closed = true;
}

var packets = {
	"0": keepalive,
	1: login,
	2: handshake,
	3: chat,
	16: changeholding,
	10: flying,
	11: playerpos,
	12: playerlook,
	13: moveandlook,
	14: blockdig,
	18: animation,
	15: blockplace,
	101: closewindow,
	102: windowclick,
	254: serverlistping,
	255: disconnect
};

var world = new world.World();
world.terrain = new terrain.WorldTerrain();
world.entities = new entities.EntityTracker(world);

function sendTicks() {
	sendPacketToAllPlayers(ps.makePacket({
		type: 0x04,
		time: world.time
	}));
	world.time += 20;
}
setInterval(sendTicks, 1000);
var server = net.createServer(function (stream) {
	var clientsession = new session.Session(world, stream);
	world.sessions.push(clientsession);
	stream.on('connect', function () {
		// ...
		var f = stream.write;
		stream.write = function () {
			if (!clientsession.closed) {
				var a = ps.parsePacketWith(arguments[0], ps.serverPacketStructure);
				masks[a.type] || hideCommonPackets && 51 != a.type && 4 != a.type && protodebug(("Server sent " + ("0x" + a.type.toString(16) + " " + ps.packetNames[a.type]).bold + ": " + sys.inspect(a)).green);
				f.apply(stream, arguments)
			}
		};
	});
	stream.on('end', function () {
		clientsession.closed = true;
		cleanupPlayer(clientsession);
		stream.end();
	});
	stream.on('error', function () {
		clientsession.closed = true;
		cleanupPlayer(clientsession);
		stream.end();
	});
	var partialData = new Buffer(0);
	stream.on('data', function (data) {
		var allData = helpers.concat(partialData, data);
		do {
		// try {
			var pkt = ps.parsePacket(allData);
			hideCommonPackets && !helpers.hiddenPackets[pkt.type] && protodebug(("Client sent " + ("0x" + pkt.type.toString(16) + " " + ps.packetNames[pkt.type]).bold + ": " + sys.inspect(pkt)).cyan);
			if (packets[pkt.type]) packets[pkt.type](clientsession, pkt);
			else protodebug("Unhandled packet".red.bold + " 0x" + pkt.type.toString(16));
			partialData = new Buffer(0);
			allData = allData.slice(pkt.length)
		// } catch (err) {
		// 	if ("oob" == err.message) partialData = allData, allData = new Buffer(0);
		// 	else throw sys.debug("Data in buffer: " + sys.inspect(allData)), sys.debug(err), err;
		// }
		} while (0 < allData.length);
	});
});

function cleanupPlayer(clientsession) {
	var session_idx = world.sessions.indexOf(clientsession),
		player_idx = world.players.indexOf(clientsession.player); - 1 != session_idx && world.sessions.splice(session_idx, 1); - 1 != player_idx && world.players.splice(player_idx, 1);
}
try {
	var cfg = String(fs.readFileSync("packet_masks")).split('\n')
} catch (err) { /*if (true || err.errno == 2) */
	cfg = [];
	//else
	//throw err;
}
var masks = {};
for (var i in ps.packetNames) {
	masks[i] = false;
}
for (var maskidx in cfg) {
	for (var i in ps.packetNames) {
		ps.packetNames[i] == cfg[maskidx] && (masks[i] = !0);
	}
}
var listenPort = 25565;
if (process.argv[2]) {
	try {
		listenPort = parseInt(process.argv[2]);
	} catch (e) {}
}
sys.puts('Nodecraft ' + 'v0.2'.bold.red + ' starting up.')
// TODO make port an option
server.listen(listenPort);
sys.puts(('Listening on port ' + listenPort).bold.grey + '...');
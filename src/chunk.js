var sys = require('util');

var transmitsLight;

var Chunk = function (y) {
	this.sizeX = 16;
	this.sizeY = 16;
	this.sizeZ = 16;

	this.yOffset = (y * this.sizeY);

	this.sectionSize = this.sizeX * this.sizeY * this.sizeZ;
	this.lit = 0;
	this.isSky = true;

	this.highest_nontransmitting_chunk = 0;

	this.dataBlockType  = new Buffer(this.sectionSize); // size 4096
	this.dataBlockType.fill(0);
	this.dataMetadata   = new Buffer(this.sectionSize / 2); // size 2048
	this.dataMetadata.fill(0);
	this.dataBlockLight = new Buffer(this.sectionSize / 2);// size 2048
	this.dataBlockLight.fill(0); 
	this.dataSkyLight   = new Buffer(this.sectionSize / 2); // size 2048
	this.dataSkyLight.fill(0);
//	this.dataAdd        = new Buffer(this.sectionSize / 2);.fill(0); // size 2048
	this.dataBiome      = new Buffer(this.sizeX * this.sizeZ); // size 256
	this.dataBiome.fill(0);

// 	this.offset = {
// 		block:    0,
// 		metadata: 1,
// 		light:    1.5,
// 		skyLight: 2,
// //		add:      2.5
// 		biome:    2.5 // 3 with addData
// 	}

	// this.data = new Buffer((this.sectionSize * 2.5) + (this.sizeX * this.sizeZ));
	// this.data.fill(0);
};

Chunk.prototype.indexOf = function (x, y, z) {
	return (y - this.yOffset) + (z * this.sizeY) + (x * this.sizeY * this.sizeZ);
};

Chunk.prototype.setType = function (x, y, z, type) {
	if (!transmitsLight(type) && (y > this.highest_nontransmitting_chunk)) {
		this.highest_nontransmitting_chunk = y;
	}

	if (!type === 0x00) {
		this.isSky = false;
	}

	this.dataBlockType[this.indexOf(x, y, z)] = type;
};

Chunk.prototype.getType = function (x, y, z) {
	return this.dataBlockType[this.indexOf(x, y, z)];
};

function setHalfByte(bufferName, index, value) {
	var trueIndex = ~~(index / 2),
		top = index % 2 === 1,
		currentValue = this[bufferName][trueIndex];

	if (top) {
		value = (currentValue & 0xf) | ((value & 0xf) << 4);
	} else {
		value = (currentValue & 0xf0) | (value & 0xf);
	}

	this[bufferName][trueIndex] = value;
}

function getHalfByte(bufferName, index) {
	var trueIndex = ~~(index / 2),
		top = index % 2 === 1,
		value = this[bufferName][trueIndex];
	if (top) {
		return (value & 0xf0) >> 4;
	} else {
		return (value & 0xf);
	}
}

Chunk.prototype.setMetadata = function (x, y, z, meta) {
	setHalfByte(
		'dataMetadata',
		this.indexOf(x, y, z),
		meta
	);
};

Chunk.prototype.getMetadata = function (x, y, z) {
	return getHalfByte(
		'dataMetadata',
		this.indexOf(x, y, z)
	);
};

Chunk.prototype.setLighting = function (x, y, z, meta) {
	setHalfByte(
		'dataBlockLight',
		this.indexOf(x, y, z),
		meta
	);
};

Chunk.prototype.getLighting = function (x, y, z) {
	return getHalfByte(
		'dataBlockLight',
		this.indexOf(x, y, z)
	);
};

Chunk.prototype.clearLight = function () {
	var x, z, y;
	for (x = 0; x < this.sizeX; x++) {
		for (z = 0; z < this.sizeZ; z++) {
			for (y = this.sizeY - 1; y >= 0; y--) {
				if (transmitsLight(this.getType(x, y, z))) {
					this.setLighting(x, y, z, 0x1);
				} else {
					this.setLighting(x, y, z, 0x0);
				}
			}
		}
	}
};

Chunk.prototype.setSkyLight = function (light) {
	var x, z, y;
	for (x = 0; x < this.sizeX; x++) {
		for (z = 0; z < this.sizeZ; z++) {
			for (y = this.sizeY - 1; y >= 0; y--) {
				if (!transmitsLight(this.getType(x, y, z))) {
					break;
				}
				this.setLighting(x, y, z, light);
			}
		}
	}
};

Chunk.prototype.getData = function() {
	return {
		BlockType: this.dataBlockType,
		Metadata: this.dataMetadata,
		BlockLight: this.dataBlockLight,
		SkyLight: this.dataSkyLight,
		Biome: this.dataBiome
	}
}


var ChunkTypes = {
	AIR: 0x00,
	STONE: 0x01,
	GRASS: 0x02,
	DIRT: 0x03,
	COBBLESTONE: 0x04,
	WOOD: 0x05,
	SAPLING: 0x06,
	ADMINIUM: 0x07,
	WATER: 0x08,

	GLASS: 0x14
};

transmitsLight = function (type) {
	return type === ChunkTypes.AIR || type === ChunkTypes.GLASS;
};

exports.ChunkTypes = ChunkTypes;
exports.Chunk = Chunk;
exports.transmitsLight = transmitsLight;

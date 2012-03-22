var sys = require('util');
var helpers = require('./helpers');

var transmitsLight;

var subChunkSizeX = 16,
	subChunkSizeY = 16,
	subChunkSizeZ = 16,
	columnChunkHeight = 16, // 16*16 = 256
	columnSizeX = subChunkSizeX,
	columnSizeY = columnChunkHeight * subChunkSizeY,
	columnSizeZ = subChunkSizeZ,
	chunkVolume = subChunkSizeX * subChunkSizeY * subChunkSizeZ,
	halfChunkVolume = chunkVolume / 2,
	chunkArea = subChunkSizeX * subChunkSizeZ;

function filledBuffer(size, val) {
	var buf = new Buffer(size);
	buf.fill(val);
	return buf;
}

// Use less memory by using the same empty buffers until data is added.
var CONST = {
	emptyFullByteChunk: filledBuffer(chunkVolume, 0x00),
	emptyHalfByteChunk: filledBuffer(halfChunkVolume, 0x00),
	lightHalfByteChunk: filledBuffer(halfChunkVolume, 0xff),
	emptyChunkArea:     filledBuffer(chunkArea, 0x00)
};


// Chuck is actually a column holding smaller chunks
var Chunk = function () {
	this.lit = 0;

	this.highest_nontransmitting_chunk = 0;

	this.biomeData       = CONST.emptyChunkArea;
	this.biomeDataUnique = false;

	var subChunks = [];
	// create empty chunks
	for (var i = 0; i < columnChunkHeight; i++) {
		subChunks[i] = {
			isEmpty: true,
			top: (i * subChunkSizeY) + (subChunkSizeY - 1),
			bottom: i * subChunkSizeY,
			blockType:  CONST.emptyFullByteChunk,
			blockTypeUnique: false,
			metaData:   CONST.emptyHalfByteChunk,
			metaDataUnique: false,
			blockLight: CONST.lightHalfByteChunk,
			blockLightUnique: false,
			skyLight:   CONST.lightHalfByteChunk,
			skyLightUnique: false,
			// addArray:   CONST.emptyHalfByteChunk, // not used yet
			// addArrayUnique false
		};
	}

	this.subChunks = subChunks;

// 	this.dataBlockType  = new Buffer(this.sectionSize); // size 4096
// 	this.dataBlockType.fill(0);
// 	this.dataMetadata   = new Buffer(this.sectionSize / 2); // size 2048
// 	this.dataMetadata.fill(0);
// 	this.dataBlockLight = new Buffer(this.sectionSize / 2);// size 2048
// 	this.dataBlockLight.fill(0); 
// 	this.dataSkyLight   = new Buffer(this.sectionSize / 2); // size 2048
// 	this.dataSkyLight.fill(0);
// //	this.dataAdd        = new Buffer(this.sectionSize / 2);.fill(0); // size 2048
// 	this.dataBiome      = new Buffer(this.sizeX * this.sizeZ); // size 256
// 	this.dataBiome.fill(0);

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



function indexOf(x, y, z) {
//	return (y & 0xf) + (z * subChunkSizeY) + (x * subChunkSizeY * subChunkSizeZ);
	y = (y & 0xf);
	return x + (z * subChunkSizeX) + (y * subChunkSizeX * subChunkSizeZ);
};

function subChunkIndex(y) {
	return y >> 4;
};

// function getSubChunk(x, y, z) {
// 	return this.subChunks[y >> 4];
// };

function setHalfByte(buffer, index, value) {
	var trueIndex = ~~(index / 2),
		top = index % 2 === 1,
		currentValue = buffer[trueIndex];

	if (top) {
		value = (currentValue & 0xf) | ((value & 0xf) << 4);
	} else {
		value = (currentValue & 0xf0) | (value & 0xf);
	}

	buffer[trueIndex] = value;
}

function getHalfByte(buffer, index) {
	var trueIndex = ~~(index / 2),
		top = index % 2 === 1,
		value = buffer[trueIndex];
	if (top) {
		return (value & 0xf0) >> 4;
	} else {
		return (value & 0xf);
	}
}


Chunk.prototype.setType = function (x, y, z, type) {
	if (!transmitsLight(type) && (y > this.highest_nontransmitting_chunk)) {
		this.highest_nontransmitting_chunk = y;
	}

	var subChunk = this.subChunks[subChunkIndex(y)];

	if (type !== 0x00) {
		if (!subChunk.blockTypeUnique) {
			subChunk.blockType = filledBuffer(chunkVolume, 0x00);
			subChunk.blockTypeUnique = true;
		}

		subChunk.isEmpty = false;
	}

	if (subChunk.blockTypeUnique)
		subChunk.blockType[indexOf(x, y, z)] = type;
};

Chunk.prototype.getType = function (x, y, z) {
	return this.subChunks[subChunkIndex(y)].blockType[indexOf(x, y, z)];
};


//ToDo: MetaData
// Chunk.prototype.setMetadata = function (x, y, z, meta) {
// 	setHalfByte(
// 		'dataMetadata',
// 		indexOf(x, y, z),
// 		meta
// 	);
// };

// Chunk.prototype.getMetadata = function (x, y, z) {
// 	return getHalfByte(
// 		'dataMetadata',
// 		indexOf(x, y, z)
// 	);
// };

Chunk.prototype.setLighting = function (x, y, z, value) {
	var subChunk = this.subChunks[subChunkIndex(y)];

	if (!subChunk.blockLightUnique) {
		subChunk.blockLight = filledBuffer(halfChunkVolume, 0x00);
		subChunk.blockLightUnique = true;
	}

	setHalfByte(
		subChunk.blockLight,
		indexOf(x, y, z),
		value
	);
};

Chunk.prototype.getLighting = function (x, y, z) {
	return getHalfByte(
		this.subChunks[subChunkIndex(y)].blockLight,
		indexOf(x, y, z)
	);
};

Chunk.prototype.clearLight = function () {
	var x, z, y;
	for (x = 0; x < columnSizeX; x++) {
		for (z = 0; z < columnSizeZ; z++) {
			for (y = columnSizeY - 1; y >= 0; y--) {
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
	for (x = 0; x < columnSizeX; x++) {
		for (z = 0; z < columnSizeZ; z++) {
			for (y = columnSizeY - 1; y >= 0; y--) {
				if (!transmitsLight(this.getType(x, y, z))) {
					break;
				}
				this.setLighting(x, y, z, light);
			}
		}
	}
};

Chunk.prototype.getData = function() {
	var blockTypeArr  = [],
		metadataArr   = [],
		blockLightArr = [],
		skyLightArr   = [],
		bitMask = 0,
		iMask   = 1,
		bufferArr,
		allDataBuf;

	for (var i = 0; i < columnChunkHeight; i++) {
		var subChunk = this.subChunks[i];
		if (!subChunk.isEmpty){
			bitMask |= iMask;
			blockTypeArr .push(subChunk.blockType);
			metadataArr  .push(subChunk.blockLight);
			blockLightArr.push(subChunk.metaData);
			skyLightArr  .push(subChunk.skyLight);
		}

		iMask <<= 1;
	}

	// Produces an array of buffers in the correct order
	bufferArr = blockTypeArr.concat(
		metadataArr,
		blockLightArr,
		skyLightArr
	);
	bufferArr.push(this.biomeData);
	
	allDataBuf = helpers.concat.apply(null, bufferArr);

	return {
		data: allDataBuf,
		bitMask: bitMask
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

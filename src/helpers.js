
exports.concat = function () {
	var totalLength = 0, buf_pos = 0;
	for(var i = 0; i < arguments.length; i++) {
		totalLength += arguments[i].length;
	}
	
	var buf = new Buffer(totalLength);
	for(var j = 0; j < arguments.length; j++) {
		arguments[j].copy(buf, buf_pos, 0);
		buf_pos += arguments[j].length;
	}
    return buf;
};

exports.findBlockCoordsForDirection = function (x, y, z, face) {
	switch (face) {
	case 0:
		return {
			x: x,
			y: y - 1,
			z: z
		};
	case 1:
		return {
			x: x,
			y: y + 1,
			z: z
		};
	case 2:
		return {
			x: x,
			y: y,
			z: z - 1
		};
	case 3:
		return {
			x: x,
			y: y,
			z: z + 1
		};
	case 4:
		return {
			x: x - 1,
			y: y,
			z: z
		};
	case 5:
		return {
			x: x + 1,
			y: y,
			z: z
		};
	}
};

exports.isUsableObject = function (type) {
	var usable_objects = {
		61: true,
		62: true,
		58: true,
		54: true
	};

	return type in usable_objects;
};

exports.hiddenPackets = {
	0x0a: true,
	0x0b: true,
	0x0c: true,
	0x0d: true,
	0x12: true,
	0x32: true
};



exports.concat = function (buf1, buf2) {
    var buf = new Buffer(buf1.length + buf2.length);
    buf1.copy(buf, 0, 0);
    buf2.copy(buf, buf1.length, 0);
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
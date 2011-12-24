
var Player = function(session) {
    this.session = session;
    this.name = "";
    
    this.X = 0;
    this.Y = 0;
    this.Z = 0;
    this.yaw = 0;
	this.pitch = 0;
	this.stance = 0;
	this.onGround = true;
	
    this.inventory = [];
	for(var i = 0; i < 45; i++)
	{
		this.inventory[i] = { id: 0, count: 0 };
	}
	
    this.currentSlot = 0;
}

exports.Player = Player;
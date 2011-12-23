
var Player = function(session) {
    this.session = session;
    this.name = "";
    
    this.X = 0;
    this.Y = 0;
    this.Z = 0;
    
    this.inventory = [];
    this.currentSlot = 0;
}

exports.Player = Player;
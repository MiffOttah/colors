// Copyright (c) 2011-2020 Miff
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.


NORTH=1;
SOUTH=2;
EAST=3;
WEST=4;

GRID_W = 24;
GRID_H = 16;

Colors = {
	White: 0,
	Red: 1,
	Blue: 2,
	Yellow: 4
}

Keys = {
/*
	Up: 38,
	Down: 40,
	Left: 37,
	Right: 39,
*/
	Up: 73,
	Down: 75,
	Left: 74,
	Right: 76,

	Tilde: 192,
	D0: 48,
	D1: 49,
	D2: 50,
	D3: 51,
	D4: 52,
	D5: 53,
	D6: 54,
	D7: 55,
	D8: 56,
	D9: 57,

	QuestionMark: 191,
	BracketOpen: 219,
	BracketClose: 221,
	Backslash: 220,

	A: 65,
	B: 66,
	C: 67,
	D: 68,
	E: 69,
	// ...,
	R: 82,
	S: 83,
	T: 84,
	U: 85,
	V: 86,
	W: 87,
	X: 88,
	Y: 89,
	Z: 90
}

var Objects = {
	Empty: 0,
	Wall: 1,
	Block: 2,
	ColorOrb: 3,
	Checkpoint: 4,
	Outline: 5,
	Keycard: 6,
	Exit: 7,
	Gate: 8,
	DuplicatorR: 9,
	DuplicatorL: 10,
	Switch1: 11,
	Switch2: 12,
	MechGateCenter: 13,
	MechGate: 14,
	Wire: 15
};
function Sign(text){
	this.special = "sign";
	this.text = text;
}
function Teleporter(dir){
	this.special = "tele";
	this.direction = dir;
}
function isMech(o){
	switch (o){
		case 9: // duplicator
		case 10: // duplicator
		case 11: // switch1
		case 12: // switch2
		case 13: // mg center
		// case 14: // mg arm
		case 15: // wire
			return true;
		default:
			return false;
	}
}


var TableCells = [];

var PlayerX = 0;
var PlayerY = 0;
var PlayerDir = NORTH;
var PlayerKeys = [];

var ActiveStockLevel = 0;
var LatestStockLevel = 0;
var LevelObjects = [];
var LevelObjectColors = [];
var LevelBeginState = null;
var LevelCheckpointState = null;

var EditMode = false;
var EditFunction = "empty";
var EditObject = 0;
var EditColor = 0;

var GameActive = false;
var PressedKeys = [];

// Preload images without having them in the main document yet.
// Later they'll be referenced by the CSS.
var PreloadedImages = [];
preloadImage("res/block.png");
preloadImage("res/checkpoint.png");
preloadImage("res/colororb.png");
preloadImage("res/door.png");
preloadImage("res/duplicator.png");
preloadImage("res/gate.png");
preloadImage("res/keycard.png");
preloadImage("res/mech_wire.png");
preloadImage("res/mechgate_arm.png");
preloadImage("res/mechgate_center_v2.png");
preloadImage("res/outline.png");
preloadImage("res/player.png");
preloadImage("res/sign.png");
preloadImage("res/switch.png");
preloadImage("res/teleporter.png");
preloadImage("res/wires.png");

function preloadImage(url){
	var img = new Image();
	img.src = url;
	PreloadedImages.push(img);
}


$(window).load(init);

(function( $ ){
  $.fn.sprite = function( n ) {
    return this.each(function() {
      var $this = $(this);
      $this.css("background-position", (-24 * (n-1)) + "px 0px");
    });
  };
})( jQuery );

function nudge(v, vertical, d){
	if (!vertical && d == WEST) v--;
	if (vertical && d == NORTH) v--;
	if (!vertical && d == EAST) v++;
	if (vertical && d == SOUTH) v++;
	return v;
}
function cardinal(callback, x, y){
	x = x || 0;
	y = y || 0;

	callback(EAST, x + 1, y);
	callback(WEST, x - 1, y);
	callback(SOUTH, x, y + 1);
	callback(NORTH, x, y - 1);
}

function oppositeDirectionOf(d){
	switch(d){
		case NORTH: return SOUTH;
		case SOUTH: return NORTH;
		case EAST: return WEST;
		case WEST: return EAST;
	}
}

function init(){
	if (checkHTML5Support()){
		$(document).keyup(onKeyUp).keydown(onKeyDown); //.keypress(onKeyPress);

		var game = $("#game");
		game.empty();

		var gametable = $("<table id=\"gametable\"></table>").appendTo(game);
		var gabletablebody = $("<tbody></tbody>").appendTo(gametable);

		for (var i = 0; i < GRID_W; i++){
			TableCells[i] = [];
			LevelObjects[i] = [];
			LevelObjectColors[i] = [];

			for (var j = 0; j < GRID_H; j++){
				LevelObjects[i][j] = 0;
				LevelObjectColors[i][j] = 0;
			}
		}

		for (var i = 0; i < GRID_H; i++){
			var tr = $("<tr></tr>").appendTo(gametable);
			for (var j = 0; j < GRID_W; j++){
				TableCells[j][i] = $("<td>&nbsp;</td>").attr("data-x", j).attr("data-y", i).appendTo(tr);
				TableCells[j][i].mousedown(editor_click);
			}
		}

		var o = gametable.offset();
		o.left += gametable.width();
		$("#player-keys").show().offset(o);

		game.append("<p id=\"signtext\"></p>");

		$(".editor-type").click(editor_type_sel);
		$(".editor-color").click(editor_color_sel);
		$("#level-display a").click(function(e){
			if (!$(this).hasClass("locked")){
				flash();
				loadStockLevel(parseInt($(this).attr("data-level"), 10));
				updateUI();
			}
			e.preventDefault();
			return false;
		});

		var initLevel = $.cookie("colors_latest_level") ? parseInt($.cookie("colors_latest_level"), 10) : 0;
		loadStockLevel(initLevel);
		for (var i = initLevel+1; i <= 9; i++){
			$("#level-display a[data-level=\"" + i.toString() + "\"]").addClass("locked");
		}

		GameActive = true;
		updateUI();
	} else {
		$("#game").addClass("no-html5").html("<p>We're sorry, but your browser cannot support this game.</p><p>Please consider upgrading to a newer browser.</p>");
		$("#game").append("<p><a href=\"http://windows.microsoft.com/en-US/internet-explorer/downloads/ie\">Internet Explorer 9</a></p>");
		$("#game").append("<p><a href=\"http://www.google.com/chrome/intl/en/landing_chrome.html?hl=en\">Google Chrome</a></p>");
		$("#game").append("<p><a href=\"http://www.opera.com/\">Opera 11</a></p>");
		$("#game").append("<p><a href=\"http://www.mozilla.com/en-US/firefox/\">Firefox 4</a></p>");
	}
}

function checkHTML5Support(){
	return !!window.JSON;
}

function setObject(x, y, type, color){
	LevelObjects[x][y] = type || Objects.Empty;
	LevelObjectColors[x][y] = color || Colors.White;
	updateUI();
}

function getLevelState(){
	return JSON.stringify({
		Objects: LevelObjects,
		Colors: LevelObjectColors,
		PlayerX: PlayerX,
		PlayerY: PlayerY,
		Keys: PlayerKeys
	});
}
function setLevelState(levelData, newLevel){
	var s = JSON.parse(levelData);

	LevelObjects = s.Objects;
	LevelObjectColors = s.Colors;
	PlayerX = s.PlayerX;
	PlayerY = s.PlayerY;
	PlayerKeys = s.Keys;

	for (var i = 0; i < GRID_W; i++){
		for (var j = 0; j < GRID_H; j++){
			if (LevelObjects[i][j].special == "sign"){
				LevelObjects[i][j] = new Sign(LevelObjects[i][j].text);
			}
			if (LevelObjects[i][j].special == "tele"){
				LevelObjects[i][j] = new Teleporter(LevelObjects[i][j].direction);
			}
		}
	}

	if (newLevel){
		LevelBeginState = levelData;
		LevelCheckpointState = levelData;
	}

	updateUI();
};
function loadStockLevel(id){
	setLevelState(StockLevels[id], true);
	ActiveStockLevel = id;

	//$("#level-number").text((id < 9 ? "0" : "") + (id + 1).toString());
	$("#level-display a").removeClass("active");
	$("#level-display a[data-level=\"" + id.toString() + "\"]").removeClass("locked").addClass("active");

	if (LatestStockLevel < ActiveStockLevel){
		LatestStockLevel = ActiveStockLevel;
		$.cookie("colors_latest_level", LatestStockLevel);
	}

	GameActive = true;
}

function flash(){
	var gametable = $("#gametable");
	var o = gametable.offset();
	$("#flash").css({
		height: gametable.height() + "px",
		width: gametable.width() + "px",
		left: o.left + "px",
		top: o.top + "px",
	}).show();
	window.setTimeout(function(){ $("#flash").fadeOut(450); }, 50);
}
function teleportEffect(x1, y1, x2, y2, color){
	var tpfx = $("<div class=\"effect color-white\"></div>").appendTo("body");

	if (color & Colors.Red) tpfx.addClass("color-red");
	if (color & Colors.Blue) tpfx.addClass("color-blue");
	if (color & Colors.Yellow) tpfx.addClass("color-yellow");

	var start = TableCells[x1][y1].offset();
	var end = TableCells[x2][y2].offset();
	var min_left = Math.min(start.left, end.left);
	var min_top = Math.min(start.top, end.top);
	var max_left = Math.max(start.left, end.left);
	var max_top = Math.max(start.top, end.top);
	tpfx.css({
		left: min_left + "px",
		top: min_top + "px",
		width: ((max_left - min_left) + 24) + "px",
		height: ((max_top - min_top) + 24) + "px"
	}).show();

	window.setTimeout(function(){ tpfx.fadeOut(450, function(){ tpfx.remove(); }); }, 50);
}

function updateUI(){
	$("#game td").attr("class", "").sprite(1);

	if (GameActive) TableCells[PlayerX][PlayerY].attr("class", "player color-white").sprite(PlayerDir);

	for (var i = 0; i < GRID_W; i++){
		for (var j = 0; j < GRID_H; j++){
			if ((!GameActive || i != PlayerX || j != PlayerY) && (LevelObjects[i][j] != Objects.Empty)){
				if (LevelObjects[i][j] == Objects.Wall){
					TableCells[i][j].addClass("obj-wall");
					continue;
				} else if (LevelObjects[i][j] == Objects.Block){
					TableCells[i][j].addClass("obj-block color-white");
				} else if (LevelObjects[i][j] == Objects.ColorOrb){
					TableCells[i][j].addClass("obj-colororb color-white");
				} else if (LevelObjects[i][j] == Objects.Outline){
					TableCells[i][j].addClass("obj-outline color-white");
				} else if (LevelObjects[i][j] == Objects.Checkpoint){
					TableCells[i][j].addClass("obj-checkpoint color-white");
				} else if (LevelObjects[i][j] == Objects.Keycard){
					TableCells[i][j].addClass("obj-keycard color-white");
				} else if (LevelObjects[i][j] == Objects.Exit){
					TableCells[i][j].addClass("obj-exit color-white");
				} else if (LevelObjects[i][j] == Objects.Gate){
					TableCells[i][j].addClass("obj-gate color-white");

				} else if (LevelObjects[i][j] == Objects.DuplicatorL){
					TableCells[i][j].addClass("obj-duplicator color-white").sprite(2);
				} else if (LevelObjects[i][j] == Objects.DuplicatorR){
					TableCells[i][j].addClass("obj-duplicator color-white").sprite(1);
				} else if (LevelObjects[i][j] == Objects.Switch1){
					TableCells[i][j].addClass("obj-switch color-white").sprite(1);
				} else if (LevelObjects[i][j] == Objects.Switch2){
					TableCells[i][j].addClass("obj-switch color-white").sprite(2);

				} else if (LevelObjects[i][j] == Objects.MechGate){
					TableCells[i][j].addClass("obj-mechgate color-white").sprite(getMechgateSprite(i, j));
				} else if (LevelObjects[i][j] == Objects.MechGateCenter){
					TableCells[i][j].addClass("obj-mechgate_center color-white");

				} else if (LevelObjects[i][j] == Objects.Wire){
					var n = 0;
					n |= wireSpriteDirectionHelper(i, j, NORTH);
					n |= wireSpriteDirectionHelper(i, j, SOUTH);
					n |= wireSpriteDirectionHelper(i, j, EAST);
					n |= wireSpriteDirectionHelper(i, j, WEST);
					if (!n) n = 0xf;
					TableCells[i][j].addClass("obj-wire").sprite(n);
					continue;

				} else if (LevelObjects[i][j] instanceof Sign){
					TableCells[i][j].addClass("obj-sign color-white");
				} else if (LevelObjects[i][j] instanceof Teleporter){
					TableCells[i][j].addClass("obj-teleporter color-white").sprite(LevelObjects[i][j].direction);
				}

				if (LevelObjectColors[i][j] & Colors.Red) TableCells[i][j].addClass("color-red");
				if (LevelObjectColors[i][j] & Colors.Blue) TableCells[i][j].addClass("color-blue");
				if (LevelObjectColors[i][j] & Colors.Yellow) TableCells[i][j].addClass("color-yellow");
			}
		}
	}

	// Signs
	var t = getActiveSignText();
	if (t){
		$("#signtext").css("visibility", "visible").text(t);
	} else {
		$("#signtext").css("visibility", "hidden");
	}

	// Keys
	var pk = $("#player-keys").empty();
	for (var i = 0; i < PlayerKeys.length; i++){
		var s = $('<span class="obj-keycard color-white">&nbsp;</span>').appendTo(pk);
		if (PlayerKeys[i] & Colors.Red) s.addClass("color-red");
		if (PlayerKeys[i] & Colors.Blue) s.addClass("color-blue");
		if (PlayerKeys[i] & Colors.Yellow) s.addClass("color-yellow");
	}
	//<span class="player-key"><span class="obj-keycard color-red">&nbsp;</span></span>
}
function wireSpriteDirectionHelper(x, y, d){
	var tX = nudge(x, false, d), tY = nudge(y, true, d);
	if (tX < 0 || tY < 0 || tX >= GRID_W || tY >= GRID_H) return;
	if (isMech(LevelObjects[tX][tY])) return 1 << (d - 1);
	else return 0;
}
function getMechgateSprite(x, y){
	if (LevelObjects[x][y-1] == Objects.MechGateCenter) return SOUTH;
	else if (LevelObjects[x-1][y] == Objects.MechGateCenter) return EAST;
	else if (LevelObjects[x+1][y] == Objects.MechGateCenter) return WEST;
	else return NORTH;
}
function getActiveSignText(){
	for (var i = -1; i <= 1; i++){
		for (var j = -1; j <= 1; j++){
			var x = PlayerX + i;
			var y = PlayerY + j;
			if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;

			if (LevelObjects[x][y] instanceof Sign){
				return LevelObjects[x][y].text;
			}
		}
	}
	return null;
}

function onKeyUp(e){
	if (PressedKeys[e.keyCode]){
		window.clearTimeout(PressedKeys[e.keyCode]);
		PressedKeys[e.keyCode] = null;
	}
}

function onKeyDown(e){
	if (GameActive){
		if (!PressedKeys[e.keyCode]){
			PressedKeys[e.keyCode] = window.setTimeout(function(){ handleRepeatKey(e.keyCode); }, 300);
		}
		handleKey(e.keyCode);
	}
}

function handleRepeatKey(key){
	if (GameActive){
		handleKey(key);
		PressedKeys[key] = window.setTimeout(function(){ handleRepeatKey(key); }, 500);
	}
}

function handleKey(key){
	if (key == Keys.Up || key == Keys.W){
		playerMove(NORTH);
	} else if (key == Keys.Down || key == Keys.S){
		playerMove(SOUTH);
	} else if (key == Keys.Right || key == Keys.D){
		playerMove(EAST);
	} else if (key == Keys.Left || key == Keys.A){
		playerMove(WEST);

	// Debugging/development functions, remember to delete eventually!
/*
	} else if (key == Keys.E){
		EditMode = !EditMode;
		$("body").toggleClass("edit-mode", EditMode);
	} else if (key == Keys.Z){
		loadStockLevel(StockLevels.length - 1);
	} else if (key == Keys.X){
		loadStockLevel(0);
	} else if (key == Keys.C){
		if (ActiveStockLevel + 1 < StockLevels.length)
			loadStockLevel(ActiveStockLevel + 1);
// */

	} else if (key == Keys.R){
		flash();
		setLevelState(LevelCheckpointState);
	} else if (key == Keys.T){
		flash();
		LevelCheckpointState = LevelBeginState;
		setLevelState(LevelBeginState);

	} else {
		//console.log("Key pressed: %o", key);
	}
}


function push(tX, tY, t2X, t2Y){
	LevelObjects[t2X][t2Y] = LevelObjects[tX][tY];
	LevelObjectColors[t2X][t2Y] = LevelObjectColors[tX][tY];
	LevelObjects[tX][tY] = 0;
	LevelObjectColors[tX][tY] = 0;
	PlayerX = tX;
	PlayerY = tY;
}

function playerMove(d){
	var tX = nudge(PlayerX, false, d), tY = nudge(PlayerY, true, d);
	PlayerDir = d;

	//console.log("t: %d, %d", tX, tY);
	if (tX < 0 || tY < 0 || tX >= GRID_W || tY >= GRID_H) return;

	//console.log("object: %o", LevelObjects[tX][tY]);
	if (!LevelObjects[tX][tY]){
		PlayerX = tX;
		PlayerY = tY;
	} else if (LevelObjects[tX][tY] == Objects.Block){
		var t2X = nudge(tX, false, d), t2Y = nudge(tY, true, d);
		if (t2X < 0 || t2Y < 0 || t2X >= GRID_W || t2Y >= GRID_H) return;

		if (!LevelObjects[t2X][t2Y]){
			push(tX, tY, t2X, t2Y);
		} else if (LevelObjects[t2X][t2Y] == Objects.Outline && LevelObjectColors[t2X][t2Y] == LevelObjectColors[tX][tY]){
			setObject(tX, tY, Objects.Empty);
			setObject(t2X, t2Y, Objects.Empty);
			PlayerX = tX;
			PlayerY = tY;
		}
	} else if (LevelObjects[tX][tY] == Objects.ColorOrb){
		var t2X = nudge(tX, false, d), t2Y = nudge(tY, true, d);
		if (t2X < 0 || t2Y < 0 || t2X >= GRID_W || t2Y >= GRID_H) return;

		if (!LevelObjects[t2X][t2Y]){
			push(tX, tY, t2X, t2Y);
		} else if (LevelObjects[t2X][t2Y] != Objects.Wall){
			if (LevelObjects[t2X][t2Y] == Objects.ColorOrb)
				LevelObjectColors[t2X][t2Y] |= LevelObjectColors[tX][tY];
			else
				LevelObjectColors[t2X][t2Y] = LevelObjectColors[tX][tY];
			setObject(tX, tY, Objects.Empty);
			PlayerX = tX;
			PlayerY = tY;
		}
	} else if (LevelObjects[tX][tY] == Objects.Checkpoint){
		flash();
		setObject(tX, tY, Objects.Empty);
		PlayerX = tX;
		PlayerY = tY;
		LevelCheckpointState = getLevelState();
	} else if (LevelObjects[tX][tY] == Objects.Keycard){
		PlayerKeys.push(LevelObjectColors[tX][tY]);
		setObject(tX, tY, Objects.Empty);
		PlayerX = tX;
		PlayerY = tY;
	} else if (LevelObjects[tX][tY] == Objects.Gate){
		if (takeKey(LevelObjectColors[tX][tY])){
			setObject(tX, tY, Objects.Empty);
			PlayerX = tX;
			PlayerY = tY;
		}
	} else if (LevelObjects[tX][tY] == Objects.Exit){
		// Reached the goal, so end the level.
		flash();
		if ((ActiveStockLevel + 1) < StockLevels.length){
			loadStockLevel(ActiveStockLevel + 1);
		} else {
			GameActive = false;
			setLevelState(VictoryLevel);
			$("#level-display a").removeClass("active");
			//$("body").addClass("game-complete");
		}
	} else if (LevelObjects[tX][tY] instanceof Teleporter){
		var teleported = false;
		if (d == LevelObjects[tX][tY].direction){
			if (LevelObjects[tX][tY].direction == NORTH || LevelObjects[tX][tY].direction == SOUTH){
				// Vertical teleport
				var offset = nudge(0, true, d);
				for (var i = tY + offset; i < GRID_H && i >= 0; i += offset){
					if (LevelObjectColors[tX][i] == LevelObjectColors[tX][tY] && LevelObjects[tX][i] == Objects.Block){
						teleportEffect(tX, tY, tX, i, LevelObjectColors[tX][tY]);
						setObject(tX, i, Objects.Empty);
						PlayerX = tX;
						PlayerY = i;
						teleported = true;
						break;
					}
				}
			} else {
				// Horizontal teleport
				var offset = nudge(0, false, d);
				for (var i = tX + offset; i < GRID_W && i >= 0; i += offset){
					if (LevelObjectColors[i][tY] == LevelObjectColors[tX][tY] && LevelObjects[i][tY] == Objects.Block){
						teleportEffect(tX, tY, i, tY, LevelObjectColors[tX][tY]);
						setObject(i, tY, Objects.Empty);
						PlayerX = i;
						PlayerY = tY;
						teleported = true;
						break;
					}
				}
			}
		}
		if (!teleported){
			var t2X = nudge(tX, false, d), t2Y = nudge(tY, true, d);
			if (t2X < 0 || t2Y < 0 || t2X >= GRID_W || t2Y >= GRID_H) return;
			if (!LevelObjects[t2X][t2Y]){
				push(tX, tY, t2X, t2Y);
			}
		}
	} else if (LevelObjects[tX][tY] == Objects.Switch1 || LevelObjects[tX][tY] == Objects.Switch2){
		LevelObjects[tX][tY] = (LevelObjects[tX][tY] == Objects.Switch1) ?  Objects.Switch2 : Objects.Switch1;
		for (var i = -1; i <= 1; i++){
			for (var j = -1; j <= 1; j++){
				if ((tX + i) < 0 || (tY + j) < 0 || (tX + i) >= GRID_W || (tY + j) >= GRID_H) continue;
				triggerMechanism(tX + i, tY + j, LevelObjectColors[tX][tY], (Math.abs(i)+Math.abs(j))==1);
			}
		}
	}

	updateUI();
}

function triggerMechanism(x, y, color, allow_wires, excluded_proliferate_direction){
	//console.log("Checking for mechanism at %d, %d colored %o : %o colored %o", x, y, color, LevelObjects[x][y], LevelObjectColors[x][y]);
	if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;

	if (LevelObjects[x][y] && (LevelObjectColors[x][y] == color)){
		//console.log("Color compatible!");
		//console.log("Triggered MechGateCenter at %d, %d", x, y);
		if (LevelObjects[x][y] == Objects.DuplicatorL){
			if (x >= 1 && x <= (GRID_W - 2) && !LevelObjects[x - 1][y] && !(PlayerX == x-1 && PlayerY == y)){
				teleportEffect(x - 1, y, x + 1, y, LevelObjectColors[x + 1][y]);
				duplicate(x + 1, y, x - 1, y);
			}
		} else if (LevelObjects[x][y] == Objects.DuplicatorR){
			if (x >= 1 && x <= (GRID_W - 2) && !LevelObjects[x + 1][y] && !(PlayerX == x+1 && PlayerY == y)){
				teleportEffect(x - 1, y, x + 1, y, LevelObjectColors[x - 1][y]);
				duplicate(x - 1, y, x + 1, y);
			}
		} else if (LevelObjects[x][y] == Objects.MechGateCenter){
			//console.log("Triggered MechGateCenter at %d, %d", x, y);
			triggerMechGateArm(x+1, y, LevelObjectColors[x][y]);
			triggerMechGateArm(x-1, y, LevelObjectColors[x][y]);
			triggerMechGateArm(x, y+1, LevelObjectColors[x][y]);
			triggerMechGateArm(x, y-1, LevelObjectColors[x][y]);
		}
	}

	if (allow_wires && LevelObjects[x][y] == Objects.Wire){
		//teleportEffect(x, y, x, y, Colors.Red);
		cardinal(function(d, tX, tY){
			if (d != excluded_proliferate_direction){
				//teleportEffect(tX, tY, tX, tY, color);
				triggerMechanism(tX, tY, color, true, oppositeDirectionOf(d));
			}
		}, x, y);
	}
}
function triggerMechGateArm(x, y, color){
	if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
	// console.log("triggerMechGateArm(%d, %d, %d)", x, y, color);
	// console.log("Object at %d, %d is %o", x, y, LevelObjects[x][y]);
	if (LevelObjects[x][y] == Objects.MechGate){
		setObject(x, y, Objects.Empty);
	} else if (!LevelObjects[x][y] && (PlayerX != x || PlayerY != y)) {
		setObject(x, y, Objects.MechGate, color);
	}
}

function duplicate(srcX, srcY, destX, destY){
	LevelObjects[destX][destY] = LevelObjects[srcX][srcY];
	LevelObjectColors[destX][destY] = LevelObjectColors[srcX][srcY];
}

function takeKey(c){
	for (var i = 0; i < PlayerKeys.length; i++){
		if (PlayerKeys[i] == c){
			PlayerKeys.splice(i, 1);
			return true;
		}
	}
	return false;
}



function editor_click(e){
	if (!EditMode) return;
	var x = Number($(this).attr("data-x"));
	var y = Number($(this).attr("data-y"));

	if (e.which == 1){
		if (EditFunction == "draw"){
			LevelObjects[x][y] = EditObject;
			LevelObjectColors[x][y] = EditColor;
		} else if (EditFunction == "empty"){
			LevelObjects[x][y] = Objects.Empty;
			LevelObjectColors[x][y] = Colors.White;
		} else if (EditFunction == "sign"){
			var t = prompt("Sign text?");
			if (t){
				LevelObjects[x][y] = new Sign(t);
				LevelObjectColors[x][y] = Colors.White;
			}
		} else if (EditFunction == "tele"){
			if (LevelObjects[x][y] instanceof Teleporter){
				if (LevelObjects[x][y].direction == NORTH) LevelObjects[x][y].direction = EAST;
				else if (LevelObjects[x][y].direction == EAST) LevelObjects[x][y].direction = SOUTH;
				else if (LevelObjects[x][y].direction == SOUTH) LevelObjects[x][y].direction = WEST;
				else LevelObjects[x][y].direction = NORTH;
			} else {
				LevelObjects[x][y] = new Teleporter(NORTH);
				LevelObjectColors[x][y] = EditColor;
			}
		} else if (EditFunction == "player"){
			LevelObjects[x][y] = Objects.Empty;
			LevelObjectColors[x][y] = Colors.White;
			PlayerX = x;
			PlayerY = y;
		} else if (EditFunction == "switch"){
			LevelObjects[x][y] = (LevelObjects[x][y] == Objects.Switch1) ? Objects.Switch2 : Objects.Switch1;
			LevelObjectColors[x][y] = EditColor;
		} else if (EditFunction == "duplicator"){
			LevelObjects[x][y] = (LevelObjects[x][y] == Objects.DuplicatorL) ? Objects.DuplicatorR : Objects.DuplicatorL;
			LevelObjectColors[x][y] = EditColor;
		}
	} else if (e.which == 2){
		LevelObjects[x][y] = Objects.Empty;
		LevelObjectColors[x][y] = Colors.White;
	}

	updateUI();
	e.preventDefault();
	return false;
}

function editor_type_sel(){
	if (!EditMode) return;
	var name = $(this).text();
	var func = $(this).attr("data-function");
	var value = Number($(this).attr("value"));

	if (func == "nuke"){
		if (confirm("Really clear level?")){
			for (var i = 0; i < GRID_W; i++){
				for (var j = 0; j < GRID_H; j++){
					LevelObjects[i][j] = 0;
					LevelObjectColors[i][j] = 0;
				}
			}
		}
		updateUI();
	} else if (func == "copy"){
		window.open("data:text/plain," + escape("'" + getLevelState() + "',"));
	} else {
		EditFunction = func;
		if (func == "draw") EditObject = value;
		$("#editor-type").text(name);
	}
}

function editor_color_sel(){
	if (!EditMode) return;
	var t = Number($(this).attr("value"));
	// console.log("Sel color: %d", t);
	if (t == 1 || t == 2 || t == 4){
		if (EditColor & t) {
			EditColor &= ~t;
		} else {
			EditColor |= t;
		}

		var dstr = "";
		if (EditColor & Colors.Red) dstr += "R"; else dstr += "-";
		if (EditColor & Colors.Blue) dstr += "B"; else dstr += "-";
		if (EditColor & Colors.Yellow) dstr += "Y"; else dstr += "-";
		$("#editor-color").text(dstr);
	}
}

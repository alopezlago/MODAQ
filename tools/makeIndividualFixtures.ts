// Regenerates the individual-format e2e fixtures. Building them through MODAQ's own exporter keeps them valid
// against whatever the QBJ writer currently emits, rather than hand-maintained JSON that can drift.
declare function require(name: string): any;
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs: any = require("fs");
const path: any = require("path");

import * as GameFormats from "src/state/GameFormats";
import * as QBJ from "src/qbj/QBJ";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

const FIXTURES = path.join(__dirname, "..", "tests", "e2e", "fixtures");
const format = GameFormats.IPNCTGameFormat;

const raw = JSON.parse(fs.readFileSync(path.join(FIXTURES, "sample-packet.json"), "utf-8"));
const packet = new PacketState();
packet.setTossups(raw.tossups.map((t: any) => new Tossup(t.question, t.answer)));
packet.setName("Test Packet");

const names: string[] = ["Alice", "Bob", "Carol", "Dave"];

const game = new GameState();
game.setGameFormat(format);
game.addNewPlayers(names.map((name) => new Player(name, name, /* isStarter */ true)));
game.loadPacket(packet);

// Tossup 1: Alice and Bob both neg early, Carol converts. Two negs on one tossup is the thing a team format
// can't represent.
game.cycles[0].addWrongBuzz(
    { player: game.players[0], points: -5, position: 1, isLastWord: false },
    0,
    format
);
game.cycles[0].addWrongBuzz(
    { player: game.players[1], points: -5, position: 2, isLastWord: false },
    0,
    format
);
game.cycles[0].addCorrectBuzz(
    {
        player: game.players[2],
        points: packet.tossups[0].getPointsAtPosition(format, 4, /* isCorrect */ true),
        position: 4,
        isLastWord: false,
    },
    0,
    format,
    /* bonusIndex */ undefined,
    /* partsCount */ undefined
);

fs.writeFileSync(
    path.join(FIXTURES, "individual-game.qbj"),
    QBJ.toQBJString(game, "Test Packet", 1),
    "utf-8"
);

// A registration file for an individual tournament: every competitor is their own one-player team, grouped
// under the club they came from
const roster = {
    version: "2.1.1",
    objects: [
        {
            type: "Tournament",
            name: "Individual Test Tournament",
            registrations: [
                {
                    name: "Test Club",
                    teams: names.map((name) => ({ name, players: [{ name }] })),
                },
            ],
        },
    ],
};

fs.writeFileSync(path.join(FIXTURES, "individual-roster.qbj"), JSON.stringify(roster, null, 2), "utf-8");

console.log("Wrote individual-game.qbj and individual-roster.qbj to", FIXTURES);
console.log("scores after tossup 1:", game.teamNames.map((n, i) => `${n}=${game.scores[0][i]}`).join(", "));

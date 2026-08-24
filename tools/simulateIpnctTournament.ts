// Builds a simulated IPNCT-style individual tournament out of the Seattle Open's real team games.
//
// Every match in a round was read off the same packet, so all 23 players heard the same 20 tossups. That lets the
// simulation reassemble genuine buzzes into individual rooms instead of inventing them: for each tossup, the
// players in a room are raced against each other using the buzz positions they actually recorded.
//
// IPNCT rules applied on top (naqt.com/rules/ipnct.html): tossups only, 15/10/-5, every wrong buzz before the end
// of the question negs, and a player who reaches the buzz-out threshold leaves the game and is ranked by when
// they got there.
declare function require(name: string): any;
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs: any = require("fs");
const path: any = require("path");

import { toJS } from "mobx";

import * as GameFormats from "src/state/GameFormats";
import * as QBJ from "src/qbj/QBJ";
import { GameState } from "src/state/GameState";
import { PacketState, Tossup } from "src/state/PacketState";
import { Player } from "src/state/TeamState";

const SRC = "C:\\Users\\mbent\\Downloads\\Seattle Open";
const OUT = "C:\\Users\\mbent\\Downloads\\Seattle Open IPNCT Sim";

const format = GameFormats.IPNCTGameFormat;

// IPNCT's buzz-out thresholds: 60 in round 1, 90 in later rounds
const buzzOutThreshold = (round: number): number => (round === 1 ? 60 : 90);

// Room sizes are a fidelity decision, not a taste one. A tossup can only be converted in a simulated room if a
// player who actually got it right is sitting in it, so small rooms manufacture dead tossups: measured over the
// real data, 8-player rooms go 33% dead against the source tournament's own 9%, 12/11 rooms 15.5%, and a single
// 16-player room 5.7%. Prelims therefore use two large rooms so everyone plays every round, and the final uses
// the format's full 16.
const roomSizes = [12, 11];
const prelimRounds = 9;
const finalistCount = 16;

interface ISourceBuzz {
    player: string;
    question: number;
    wordIndex: number;
    value: number;
}

interface IRound {
    round: number;
    packetFile: string;
    label: string;
    buzzes: ISourceBuzz[];
}

// ---------------------------------------------------------------- load source

// Which packet file each QBJ `packets` label refers to (see simMapPackets.ts -- verified by checking that every
// recorded buzz position is a legal word index in that packet)
const labelToPacketFile: { [label: string]: string } = {
    "Packet 1(1)": "Packet 1.json",
    "Packet 2": "Packet 2.json",
    "Packet 4": "Packet 3.json",
    "Packet 5": "Packet 4.json",
    "Packet 6": "Packet 5.json",
    "Packet 7": "Packet 6.json",
    "Packet 8": "Packet 7.json",
    "Packet 9(1)": "Packet 8.json",
    "Packet 10(1)": "Packet 9.json",
    "Packet 11(1)": "Packet 10.json",
};

const playerTeam = new Map<string, string>();
const buzzesByLabel = new Map<string, ISourceBuzz[]>();

for (const name of fs.readdirSync(SRC).filter((n: string) => n.endsWith(".qbj"))) {
    const match = JSON.parse(fs.readFileSync(path.join(SRC, name), "utf-8"));
    const label: string = match.packets;

    for (const mt of match.match_teams) {
        for (const mp of mt.match_players) {
            playerTeam.set(mp.player.name, mt.team.name);
        }
    }

    if (!buzzesByLabel.has(label)) {
        buzzesByLabel.set(label, []);
    }

    const list = buzzesByLabel.get(label) as ISourceBuzz[];
    for (const mq of match.match_questions) {
        for (const buzz of mq.buzzes ?? []) {
            list.push({
                player: buzz.player.name,
                question: mq.question_number,
                wordIndex: buzz.buzz_position.word_index,
                value: buzz.result.value,
            });
        }
    }
}

// Order rounds by the packet file they used, so the simulated round numbers follow the real reading order
const rounds: IRound[] = [...buzzesByLabel.entries()]
    .map(([label, buzzes]) => ({ label, buzzes, packetFile: labelToPacketFile[label], round: 0 }))
    .sort((a, b) => packetNumber(a.packetFile) - packetNumber(b.packetFile));
rounds.forEach((r, i) => (r.round = i + 1));

function packetNumber(file: string): number {
    return parseInt(file.replace(/\D/g, ""), 10);
}

const allPlayers: string[] = [...playerTeam.keys()].sort();

// ------------------------------------------------------------------ simulate

interface IPlayerStanding {
    name: string;
    team: string;
    points: number;
    powers: number;
    gets: number;
    negs: number;
    tossupsHeard: number;
    buzzOuts: number;
    gamesPlayed: number;
}

const standings = new Map<string, IPlayerStanding>();
for (const name of allPlayers) {
    standings.set(name, {
        name,
        team: playerTeam.get(name) as string,
        points: 0,
        powers: 0,
        gets: 0,
        negs: 0,
        tossupsHeard: 0,
        buzzOuts: 0,
        gamesPlayed: 0,
    });
}

interface IRoomResult {
    round: number;
    room: number;
    roomName: string;
    packetFile: string;
    players: string[];
    scores: Map<string, number>;
    buzzOutOrder: string[];
    tossupsRead: number;
    negCount: number;
    multiNegTossups: number;
    deadTossups: number;
    gameJson: any;
    qbj: any;
}

const roomResults: IRoomResult[] = [];

function loadPacket(packetFile: string): PacketState {
    const raw = JSON.parse(fs.readFileSync(path.join(SRC, packetFile), "utf-8"));
    const packet = new PacketState();
    packet.setTossups(raw.tossups.map((t: any) => new Tossup(t.question, t.answer, t.metadata)));
    packet.setName(packetFile.replace(/\.json$/, ""));
    return packet;
}

// Round 1 rooms split teammates up, the way a real individual tournament would seed before it has any results
function initialRooms(): string[][] {
    const byTeam = new Map<string, string[]>();
    for (const name of allPlayers) {
        const team = playerTeam.get(name) as string;
        if (!byTeam.has(team)) {
            byTeam.set(team, []);
        }
        (byTeam.get(team) as string[]).push(name);
    }

    // Deal players out one team at a time, so no room fills up with a single team
    const rooms: string[][] = roomSizes.map(() => []);
    let cursor = 0;
    for (const team of [...byTeam.keys()].sort()) {
        for (const name of byTeam.get(team) as string[]) {
            let placed = false;
            for (let attempt = 0; attempt < rooms.length && !placed; attempt++) {
                const index = (cursor + attempt) % rooms.length;
                if (rooms[index].length < roomSizes[index]) {
                    rooms[index].push(name);
                    cursor = index + 1;
                    placed = true;
                }
            }
        }
    }

    return rooms;
}

// Later rounds re-seed by standing, but snake the seeds across the rooms rather than stacking the leaders into
// one. Tiered rooms would compound the dead-tossup artifact: the weak room would lose conversions both because
// its players are weaker and because fewer of the field's real converters are sitting in it.
function seededRooms(order: string[]): string[][] {
    const rooms: string[][] = roomSizes.map(() => []);
    let direction = 1;
    let room = 0;
    for (const name of order) {
        while (rooms[room].length >= roomSizes[room]) {
            room = (room + 1) % rooms.length;
        }

        rooms[room].push(name);
        if ((direction > 0 && room === rooms.length - 1) || (direction < 0 && room === 0)) {
            direction = -direction;
        } else {
            room += direction;
        }
    }

    return rooms;
}

function standingOrder(): string[] {
    return [...standings.values()]
        .sort((a, b) => b.points - a.points || b.powers - a.powers || a.negs - b.negs || a.name.localeCompare(b.name))
        .map((s) => s.name);
}

function playRoom(round: IRound, roomIndex: number, roomName: string, roster: string[]): IRoomResult {
    const packet = loadPacket(round.packetFile);

    const game = new GameState();
    game.setGameFormat(format);
    // Each competitor is their own one-player team
    game.addNewPlayers(roster.map((name) => new Player(name, name, /* isStarter */ true)));
    game.loadPacket(packet);

    const inRoom = new Set<string>(roster);
    const buzzedOut = new Set<string>();
    const buzzOutOrder: string[] = [];
    const scores = new Map<string, number>(roster.map((name) => [name, 0]));
    const threshold = buzzOutThreshold(round.round);

    let negCount = 0;
    let multiNegTossups = 0;
    let deadTossups = 0;

    const tossupCount = Math.min(packet.tossups.length, format.regulationTossupCount);

    for (let q = 0; q < tossupCount; q++) {
        const tossup = packet.tossups[q];
        const lastBuzzableIndex = tossup.getWords(format).filter((word) => word.canBuzzOn).length - 1;
        const cycle = game.cycles[q];

        // Everyone still in the room races on this tossup, using the buzz position they actually recorded
        const candidates = round.buzzes
            .filter((b) => b.question === q + 1 && inRoom.has(b.player) && !buzzedOut.has(b.player))
            .sort((a, b) => a.wordIndex - b.wordIndex);

        let negsThisTossup = 0;
        let converted = false;

        for (const candidate of candidates) {
            const player = game.players.find((p) => p.name === candidate.player) as Player;
            const isCorrect = candidate.value > 0;

            if (isCorrect) {
                cycle.addCorrectBuzz(
                    {
                        player,
                        position: candidate.wordIndex,
                        isLastWord: candidate.wordIndex === lastBuzzableIndex,
                        points: tossup.getPointsAtPosition(format, candidate.wordIndex, /* isCorrect */ true),
                    },
                    q,
                    format,
                    /* bonusIndex */ undefined,
                    /* partsCount */ undefined
                );
                converted = true;
                // The first correct answer ends the tossup, so nobody after this ever got to buzz
                break;
            }

            const points = tossup.getPointsAtPosition(format, candidate.wordIndex, /* isCorrect */ false);
            cycle.addWrongBuzz(
                {
                    player,
                    position: candidate.wordIndex,
                    isLastWord: candidate.wordIndex === lastBuzzableIndex,
                    points,
                },
                q,
                format
            );

            if (points < 0) {
                negsThisTossup++;
            }
        }

        negCount += negsThisTossup;
        if (negsThisTossup > 1) {
            multiNegTossups++;
        }
        if (!converted) {
            deadTossups++;
        }

        // Score through this tossup, then retire anyone who has reached the buzz-out threshold
        const scoreRow = game.scores[q];
        game.teamNames.forEach((teamName, index) => scores.set(teamName, scoreRow[index]));

        for (const name of roster) {
            if (!buzzedOut.has(name) && (scores.get(name) as number) >= threshold) {
                buzzedOut.add(name);
                buzzOutOrder.push(name);
                inRoom.delete(name);
            }
        }
    }

    // Roll the room into the tournament standings
    for (const name of roster) {
        const standing = standings.get(name) as IPlayerStanding;
        standing.points += scores.get(name) as number;
        standing.tossupsHeard += tossupCount;
        standing.gamesPlayed++;
        if (buzzedOut.has(name)) {
            standing.buzzOuts++;
        }
    }

    for (const cycle of game.cycles.slice(0, tossupCount)) {
        if (cycle.correctBuzz) {
            const standing = standings.get(cycle.correctBuzz.marker.player.name) as IPlayerStanding;
            if ((cycle.correctBuzz.marker.points ?? 0) > 10) {
                standing.powers++;
            } else {
                standing.gets++;
            }
        }

        for (const wrong of cycle.wrongBuzzes ?? []) {
            if (wrong.marker.points < 0) {
                (standings.get(wrong.marker.player.name) as IPlayerStanding).negs++;
            }
        }
    }

    const gameJson = {
        cycles: game.cycles.slice(0, tossupCount).map((cycle) => toJS(cycle)),
        gameFormat: format,
        players: roster.map((name) => ({ name, teamName: name, isStarter: true })),
        packet: {
            name: packet.name,
            tossups: packet.tossups.map((t) => ({ question: t.question, answer: t.answer })),
        },
    };

    // The same room as a QBJ match file, so it can be read back through Import from QBJ as well as raw import
    const qbj = QBJ.toQBJ(game, packet.name, round.round);

    return {
        round: round.round,
        room: roomIndex + 1,
        roomName,
        packetFile: round.packetFile,
        players: roster,
        scores,
        buzzOutOrder,
        tossupsRead: tossupCount,
        negCount,
        multiNegTossups,
        deadTossups,
        gameJson,
        qbj,
    };
}

const roomLabels = ["A", "B", "C"];

let prelimStandings: IPlayerStanding[] = [];
let finalists: string[] = [];

for (const round of rounds) {
    const isFinal = round.round > prelimRounds;

    if (isFinal) {
        // Freeze the prelim table first: everyone played the same nine games, so it ranks on equal footing.
        // The final adds a tenth game for finalists only, and is scored on its own.
        prelimStandings = standingOrder().map((name) => ({ ...(standings.get(name) as IPlayerStanding) }));
        finalists = standingOrder().slice(0, finalistCount);
        roomResults.push(playRoom(round, 0, "Final", finalists));
        continue;
    }

    const rooms = round.round === 1 ? initialRooms() : seededRooms(standingOrder());
    rooms.forEach((roster, index) => {
        roomResults.push(playRoom(round, index, `Room ${roomLabels[index]}`, roster));
    });
}

// -------------------------------------------------------------------- output

if (!fs.existsSync(OUT)) {
    fs.mkdirSync(OUT, { recursive: true });
}

// Clear out anything from a previous run so a changed room layout can't leave orphaned games behind
for (const stale of fs.readdirSync(OUT).filter((n: string) => n.endsWith(".json") || n.endsWith(".qbj"))) {
    fs.unlinkSync(path.join(OUT, stale));
}

for (const result of roomResults) {
    const suffix = result.roomName === "Final" ? "Final" : `Room_${roomLabels[result.room - 1]}`;
    const stem = `Round_${result.round}_${suffix}`;

    // Raw game files carry the packet inline, so they reopen exactly as read; the QBJ files are the interchange
    // format and need the packet supplied separately on import
    fs.writeFileSync(path.join(OUT, `${stem}.json`), JSON.stringify(result.gameJson, null, 2), "utf-8");
    fs.writeFileSync(path.join(OUT, `${stem}.qbj`), JSON.stringify(result.qbj, null, 2), "utf-8");
}

// A tournament registration file listing every competitor. An individual tournament has no schools to enter as
// teams, so each player registers as their own one-player team, grouped under the club they actually came from.
const registrations = new Map<string, string[]>();
for (const name of allPlayers) {
    const team = playerTeam.get(name) as string;
    if (!registrations.has(team)) {
        registrations.set(team, []);
    }
    (registrations.get(team) as string[]).push(name);
}

const roster = {
    version: "2.1.1",
    objects: [
        {
            type: "Tournament",
            name: "Individual Seattle Open (simulated)",
            registrations: [...registrations.entries()].map(([team, names]) => ({
                name: team,
                teams: names.map((name) => ({ name, players: [{ name }] })),
            })),
        },
    ],
};

fs.writeFileSync(path.join(OUT, "roster.qbj"), JSON.stringify(roster, null, 2), "utf-8");

const finalRoom = roomResults[roomResults.length - 1];
const finalScores = [...finalRoom.scores.entries()].sort((a, b) => b[1] - a[1]);

const summary = {
    generatedFrom: SRC,
    format: format.displayName,
    rounds: rounds.length,
    prelimRounds,
    players: allPlayers.length,
    rooms: roomResults.length,
    champion: finalScores[0][0],
    prelimStandings: prelimStandings.map((s, index) => ({
        rank: index + 1,
        name: s.name,
        team: s.team,
        points: s.points,
        powers: s.powers,
        gets: s.gets,
        negs: s.negs,
        tossupsHeard: s.tossupsHeard,
        buzzOuts: s.buzzOuts,
        gamesPlayed: s.gamesPlayed,
        pointsPerTossup: +(s.points / s.tossupsHeard).toFixed(3),
        madeFinal: finalists.indexOf(s.name) >= 0,
    })),
    finalResult: finalScores.map(([name, points], index) => ({ rank: index + 1, name, points })),
    games: roomResults.map((r) => ({
        round: r.round,
        room: r.roomName,
        packet: r.packetFile,
        tossupsRead: r.tossupsRead,
        deadTossups: r.deadTossups,
        negs: r.negCount,
        tossupsWithMultipleNegs: r.multiNegTossups,
        buzzOutOrder: r.buzzOutOrder,
        scores: [...r.scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, points]) => ({ name, points })),
    })),
};

fs.writeFileSync(path.join(OUT, "tournament.json"), JSON.stringify(summary, null, 2), "utf-8");

// ------------------------------------------------------------------- console

console.log(
    `Wrote ${roomResults.length} raw game files, ${roomResults.length} QBJ files, roster.qbj and tournament.json to ${OUT}`
);
console.log();
console.log(`Players: ${allPlayers.length}   Rounds: ${rounds.length} (${prelimRounds} prelim + final)`);

const totalNegs = roomResults.reduce((sum, r) => sum + r.negCount, 0);
const totalMulti = roomResults.reduce((sum, r) => sum + r.multiNegTossups, 0);
const totalDead = roomResults.reduce((sum, r) => sum + r.deadTossups, 0);
const totalTossups = roomResults.reduce((sum, r) => sum + r.tossupsRead, 0);
const totalBuzzOuts = roomResults.reduce((sum, r) => sum + r.buzzOutOrder.length, 0);
console.log(
    `Tossups: ${totalTossups}   negs: ${totalNegs}   tossups with 2+ negs: ${totalMulti}   dead: ${totalDead}   buzz-outs: ${totalBuzzOuts}`
);
console.log();
console.log(`Dead tossups: ${totalDead}/${totalTossups} (${((100 * totalDead) / totalTossups).toFixed(1)}%)`);
console.log();
console.log("Preliminary standings after 9 rounds (everyone played all nine)");
console.log("   #  Player               Team                       Pts  15/10/-5   P/TU   Final?");
prelimStandings.forEach((s, index) => {
    console.log(
        `  ${String(index + 1).padStart(2)}  ${s.name.padEnd(20)} ${s.team.substring(0, 24).padEnd(25)}${String(
            s.points
        ).padStart(5)}  ${`${s.powers}/${s.gets}/${s.negs}`.padEnd(10)}${(s.points / s.tossupsHeard)
            .toFixed(2)
            .padStart(5)}   ${finalists.indexOf(s.name) >= 0 ? "yes" : ""}`
    );
});
console.log();
console.log(`Final (16 players, ${finalRoom.packetFile})`);
finalScores.forEach(([name, points], index) => {
    console.log(`  ${String(index + 1).padStart(2)}  ${name.padEnd(20)} ${String(points).padStart(5)}`);
});
console.log();
console.log(`Champion: ${finalScores[0][0]}`);

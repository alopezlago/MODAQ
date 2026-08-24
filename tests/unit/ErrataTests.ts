import { expect } from "chai";

import * as ErrataDialogController from "src/components/dialogs/ErrataDialogController";
import * as ErrataExport from "src/state/ErrataExport";
import * as GameFormats from "src/state/GameFormats";
import { AppState } from "src/state/AppState";
import { Bonus, PacketState, Tossup } from "src/state/PacketState";
import { IErrataExport, IErratumExport } from "src/state/ErrataExport";
import { ModalVisibilityStatus } from "src/state/ModalVisibilityStatus";
import { Player } from "src/state/TeamState";

const firstTeamPlayer: Player = new Player("Alice", "Alpha", /* isStarter */ true);
const secondTeamPlayer: Player = new Player("Bob", "Beta", /* isStarter */ true);

function createAppStateWithGame(): AppState {
    const appState: AppState = new AppState();

    const packet: PacketState = new PacketState();
    packet.setTossups([
        new Tossup("This is the first tossup.", "first answer", "Packet 1, Tossup 1"),
        new Tossup("This is the <pg>second</pg> tossup.", "second answer"),
    ]);
    packet.setBonuses([
        new Bonus("This is the first leadin.", [
            { question: "First part", answer: "first part answer", value: 10 },
            { question: "Second part", answer: "second part answer", value: 10 },
        ]),
    ]);
    packet.setName("Packet 1.docx");

    appState.game.addNewPlayers([firstTeamPlayer, secondTeamPlayer]);
    appState.game.loadPacket(packet);
    appState.game.setGameFormat(GameFormats.ACFGameFormat);

    return appState;
}

describe("ErrataTests", () => {
    describe("ErrataState", () => {
        it("setErratum adds an erratum for a question", () => {
            const appState: AppState = new AppState();

            appState.errata.setErratum({
                questionNumber: 3,
                questionType: "tossup",
                thrownOut: false,
                text: "  The answer line is wrong.  ",
            });

            const erratum = appState.errata.getErratum(3, "tossup");
            if (erratum == undefined) {
                throw new Error("No erratum was recorded");
            }

            expect(erratum.text).to.equal("The answer line is wrong.");
            expect(erratum.at).to.not.be.undefined;
            // The tossup and the bonus at the same number are different questions
            expect(appState.errata.getErratum(3, "bonus")).to.be.undefined;
        });

        it("setErratum replaces the erratum for the same question", () => {
            const appState: AppState = new AppState();

            appState.errata.setErratum({ questionNumber: 3, questionType: "tossup", thrownOut: false, text: "First" });
            appState.errata.setErratum({ questionNumber: 3, questionType: "tossup", thrownOut: false, text: "Second" });

            expect(appState.errata.errata.length).to.equal(1);
            expect(appState.errata.getErratum(3, "tossup")?.text).to.equal("Second");
        });

        it("setErratum with blank text removes the erratum", () => {
            const appState: AppState = new AppState();

            appState.errata.setErratum({ questionNumber: 3, questionType: "tossup", thrownOut: false, text: "First" });
            appState.errata.setErratum({ questionNumber: 3, questionType: "tossup", thrownOut: false, text: "   " });

            expect(appState.errata.errata.length).to.equal(0);
        });

        it("getSortedErrata orders by question number, then type", () => {
            const appState: AppState = new AppState();

            appState.errata.setErratum({ questionNumber: 2, questionType: "tossup", thrownOut: false, text: "T2" });
            appState.errata.setErratum({ questionNumber: 1, questionType: "tossup", thrownOut: false, text: "T1" });
            appState.errata.setErratum({ questionNumber: 1, questionType: "bonus", thrownOut: false, text: "B1" });

            expect(appState.errata.getSortedErrata().map((erratum) => erratum.text)).to.deep.equal([
                "B1",
                "T1",
                "T2",
            ]);
        });
    });

    describe("ErrataDialogController", () => {
        it("showDialog opens the dialog seeded with the existing erratum", () => {
            const appState: AppState = createAppStateWithGame();
            appState.errata.setErratum({
                questionNumber: 1,
                questionType: "tossup",
                thrownOut: false,
                text: "Prompt on 'H'",
            });

            ErrataDialogController.showDialog(appState, 1, "tossup");

            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.Errata);

            const errataDialog = appState.uiState.dialogState.errataDialog;
            if (errataDialog == undefined) {
                throw new Error("Errata dialog wasn't opened");
            }

            expect(errataDialog.questionNumber).to.equal(1);
            expect(errataDialog.questionType).to.equal("tossup");
            expect(errataDialog.text).to.equal("Prompt on 'H'");
            expect(errataDialog.existed).to.be.true;
        });

        it("submit records the erratum and closes the dialog", () => {
            const appState: AppState = createAppStateWithGame();

            ErrataDialogController.showDialog(appState, 2, "bonus");
            ErrataDialogController.changeText(appState, "Part 2's answer is unclear.");
            ErrataDialogController.submit(appState);

            expect(appState.errata.getErratum(2, "bonus")?.text).to.equal("Part 2's answer is unclear.");
            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.None);
            expect(appState.uiState.dialogState.errataDialog).to.be.undefined;
        });

        it("removeErratum removes the erratum for the question being edited", () => {
            const appState: AppState = createAppStateWithGame();
            appState.errata.setErratum({ questionNumber: 1, questionType: "tossup", thrownOut: false, text: "Wrong" });

            ErrataDialogController.showDialog(appState, 1, "tossup");
            ErrataDialogController.removeErratum(appState);

            expect(appState.errata.errata.length).to.equal(0);
            expect(appState.uiState.dialogState.visibleDialog).to.equal(ModalVisibilityStatus.None);
        });
    });

    describe("ErrataExport", () => {
        it("no errata means no export", () => {
            const appState: AppState = createAppStateWithGame();

            expect(ErrataExport.createErrataExport(appState, 3)).to.be.undefined;
        });

        it("a tossup erratum names the question and includes its text", () => {
            const appState: AppState = createAppStateWithGame();
            appState.errata.setErratum({
                questionNumber: 1,
                questionType: "tossup",
                thrownOut: false,
                text: "Should also accept 'the first'.",
            });

            const errataExport: IErrataExport | undefined = ErrataExport.createErrataExport(appState, 3);
            if (errataExport == undefined) {
                throw new Error("Nothing was exported");
            }

            expect(errataExport.type).to.equal("modaq-errata");
            expect(errataExport.round).to.equal(3);
            expect(errataExport.packetName).to.equal("Packet 1.docx");
            expect(errataExport.teams).to.deep.equal(["Alpha", "Beta"]);
            expect(errataExport.errata.length).to.equal(1);

            const erratum: IErratumExport = errataExport.errata[0];
            expect(erratum.question).to.equal("Tossup 1");
            expect(erratum.questionType).to.equal("tossup");
            expect(erratum.questionNumber).to.equal(1);
            expect(erratum.errata).to.equal("Should also accept 'the first'.");
            expect(erratum.questionText).to.equal("This is the first tossup.");
            expect(erratum.answer).to.equal("first answer");
            expect(erratum.metadata).to.equal("Packet 1, Tossup 1");
            expect(erratum.recordedAt).to.not.be.undefined;
        });

        it("a bonus erratum includes the leadin and every part", () => {
            const appState: AppState = createAppStateWithGame();
            appState.errata.setErratum({
                questionNumber: 1,
                questionType: "bonus",
                thrownOut: false,
                text: "Part 1 is unanswerable.",
            });

            const errataExport: IErrataExport | undefined = ErrataExport.createErrataExport(appState, 3);
            if (errataExport == undefined) {
                throw new Error("Nothing was exported");
            }

            const erratum: IErratumExport = errataExport.errata[0];
            expect(erratum.question).to.equal("Bonus 1");
            expect(erratum.questionText).to.equal(
                "This is the first leadin.\n[1] First part\n[2] Second part"
            );
            expect(erratum.answer).to.equal("[1] first part answer\n[2] second part answer");
        });

        it("pronunciation guide anchors are stripped from the exported question", () => {
            const appState: AppState = createAppStateWithGame();
            appState.errata.setErratum({
                questionNumber: 2,
                questionType: "tossup",
                thrownOut: false,
                text: "Typo in the third clue.",
            });

            const errataExport: IErrataExport | undefined = ErrataExport.createErrataExport(appState, 3);

            expect(errataExport?.errata[0].questionText).to.equal("This is the second tossup.");
        });

        it("a question that isn't in the packet still exports its erratum", () => {
            const appState: AppState = createAppStateWithGame();
            appState.errata.setErratum({
                questionNumber: 21,
                questionType: "tossup",
                thrownOut: false,
                text: "A tiebreaker had an error.",
            });

            const errataExport: IErrataExport | undefined = ErrataExport.createErrataExport(appState, 3);
            if (errataExport == undefined) {
                throw new Error("Nothing was exported");
            }

            const erratum: IErratumExport = errataExport.errata[0];
            expect(erratum.question).to.equal("Tossup 21");
            expect(erratum.errata).to.equal("A tiebreaker had an error.");
            expect(erratum.questionText).to.be.undefined;
            expect(erratum.answer).to.be.undefined;
        });

        it("the filename identifies the round and teams", () => {
            const appState: AppState = createAppStateWithGame();

            expect(ErrataExport.getErrataFilename(appState, 3)).to.equal("Round_3_Alpha_Beta_Errata.json");
        });
    });
});

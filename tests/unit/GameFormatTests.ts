import { expect } from "chai";

import * as GameFormats from "src/state/GameFormats";
import { IGameFormat } from "src/state/IGameFormat";

describe("GameFormatTests", () => {
    describe("getUpgradedFormatVersion", () => {
        // Most of these tests are handled by FormattedTextParserTests, so just test that it's hooked up to it and that
        // we include the end character
        it("Current version succeeds, no changes", () => {
            const upgradedFormat: IGameFormat = GameFormats.getUpgradedFormatVersion(GameFormats.UndefinedGameFormat);
            expect(upgradedFormat).to.equal(GameFormats.UndefinedGameFormat);
        });
        it("Unknown version with same fields succeeds", () => {
            const gameFormat: IGameFormat = { ...GameFormats.UndefinedGameFormat, version: "unknown" };

            const upgradedFormat: IGameFormat = GameFormats.getUpgradedFormatVersion(gameFormat);

            // Change the version back
            upgradedFormat.version = GameFormats.UndefinedGameFormat.version;
            expect(upgradedFormat).to.deep.equal(GameFormats.UndefinedGameFormat);
        });
        it("Unknown version with same fields, different values succeeds", () => {
            const gameFormat: IGameFormat = { ...GameFormats.ACFGameFormat, version: "unknown" };

            const upgradedFormat: IGameFormat = GameFormats.getUpgradedFormatVersion(gameFormat);

            // Change the version back
            upgradedFormat.version = GameFormats.UndefinedGameFormat.version;
            expect(upgradedFormat).to.deep.equal(GameFormats.ACFGameFormat);
        });
        it("Unknown version with undefined field throws error", () => {
            const gameFormat: IGameFormat = {
                ...GameFormats.UndefinedGameFormat,
                version: "unknown",
            };

            (gameFormat as IGameFormat | { negValue: number | undefined }).negValue = undefined;
            expect(() => GameFormats.getUpgradedFormatVersion(gameFormat)).to.throw;
        });
        it("Unknown version with different type throws error", () => {
            const gameFormat: IGameFormat = {
                ...GameFormats.UndefinedGameFormat,
                version: "unknown",
            };

            (gameFormat as IGameFormat | { negValue: string | undefined }).negValue = "-5";
            expect(() => GameFormats.getUpgradedFormatVersion(gameFormat)).to.throw;
        });
    });
});

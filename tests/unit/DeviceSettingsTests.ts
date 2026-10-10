import { expect } from "chai";

import { keepDeviceSettings, withDeviceSettings } from "src/state/DeviceSettings";

// The other moderator's screen: microphone tracking off, its own font size, on question 2
const otherScreen = {
    game: { cycles: [] as unknown[] },
    uiState: {
        cycleIndex: 1,
        showingBonus: false,
        trackReaderWithMicrophone: false,
        showReaderPositionWhileReading: false,
        questionFontSize: 24,
        useDarkMode: false,
    },
};

describe("DeviceSettingsTests", () => {
    it("Applying the other screen's game keeps this screen's microphone tracking on", () => {
        const snapshot = JSON.parse(JSON.stringify(otherScreen));
        const local = { trackReaderWithMicrophone: true, showReaderPositionWhileReading: true, questionFontSize: 18 };
        keepDeviceSettings(snapshot, local);
        expect(snapshot.uiState.trackReaderWithMicrophone).to.equal(true);
        expect(snapshot.uiState.showReaderPositionWhileReading).to.equal(true);
        expect(snapshot.uiState.questionFontSize).to.equal(18);
        // The game itself still comes from the other screen
        expect(snapshot.uiState.cycleIndex).to.equal(1);
    });

    it("Keeps dark mode only when asked (a host that owns the theme)", () => {
        const a = JSON.parse(JSON.stringify(otherScreen));
        keepDeviceSettings(a, { useDarkMode: true });
        expect(a.uiState.useDarkMode).to.equal(false);
        const b = JSON.parse(JSON.stringify(otherScreen));
        keepDeviceSettings(b, { useDarkMode: true }, ["useDarkMode"]);
        expect(b.uiState.useDarkMode).to.equal(true);
    });

    it("Seeding a reload keeps the settings this screen saved", () => {
        const local = JSON.stringify({ uiState: { trackReaderWithMicrophone: true, questionFontSize: 18 } });
        const seeded = JSON.parse(withDeviceSettings(JSON.stringify(otherScreen), local));
        expect(seeded.uiState.trackReaderWithMicrophone).to.equal(true);
        expect(seeded.uiState.questionFontSize).to.equal(18);
        expect(seeded.uiState.cycleIndex).to.equal(1);
    });

    it("A device that never saved settings doesn't take the other moderator's microphone tracking", () => {
        const reader = JSON.parse(JSON.stringify(otherScreen));
        reader.uiState.trackReaderWithMicrophone = true;
        const seeded = JSON.parse(withDeviceSettings(JSON.stringify(reader), null));
        expect("trackReaderWithMicrophone" in seeded.uiState).to.equal(false);
        expect(seeded.uiState.cycleIndex).to.equal(1);
    });

    it("Leaves a snapshot without uiState (or unparseable) alone", () => {
        expect(withDeviceSettings("not json", null)).to.equal("not json");
        const noUi = JSON.stringify({ game: {} });
        expect(withDeviceSettings(noUi, null)).to.equal(noUi);
    });
});

import { expect } from "chai";

import { getReplacementIndexForConfirmation } from "src/components/dialogs/ThrowOutQuestionDialog";

describe("ThrowOutQuestionDialogTests", () => {
    describe("getReplacementIndexForConfirmation", () => {
        it("Sequential default replacement stays implicit", () => {
            expect(getReplacementIndexForConfirmation(2, /* showCustomInput */ false, /* explicit */ false)).to.equal(
                undefined
            );
        });

        it("Protest default replacement stays explicit", () => {
            expect(getReplacementIndexForConfirmation(4, /* showCustomInput */ false, /* explicit */ true)).to.equal(3);
        });

        it("Custom replacement stays explicit", () => {
            expect(getReplacementIndexForConfirmation(3, /* showCustomInput */ true, /* explicit */ false)).to.equal(2);
        });

        it("Undefined replacement stays undefined", () => {
            expect(
                getReplacementIndexForConfirmation(undefined, /* showCustomInput */ false, /* explicit */ false)
            ).to.equal(undefined);
        });
    });
});

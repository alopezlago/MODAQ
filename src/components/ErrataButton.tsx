import * as React from "react";
import { observer } from "mobx-react-lite";
import { IIconProps, ITheme, memoizeFunction, mergeStyleSets, ThemeContext } from "@fluentui/react";
import { IconButton } from "@fluentui/react/lib/Button";

import * as ErrataDialogController from "./dialogs/ErrataDialogController";
import { AppState } from "../state/AppState";
import { useAppState } from "../contexts/StateContext";
import { IErratum, QuestionType } from "../state/IErratum";

const errataIconProps: IIconProps = { iconName: "Flag" };

// Lets the moderator note an error in the question they're reading. It sits in the question's top-right corner
// (next to the throw-out button), and fills in once that question has an erratum.
export const ErrataButton = observer(function ErrataButton(props: IErrataButtonProps): JSX.Element {
    const appState: AppState = useAppState();

    const erratum: IErratum | undefined = appState.errata.getErratum(props.questionNumber, props.questionType);
    const questionName = `${props.questionType === "bonus" ? "bonus" : "tossup"} ${props.questionNumber}`;
    const tooltip: string =
        erratum == undefined ? `Note an erratum for ${questionName}` : `Erratum: ${erratum.text}`;

    const onClick: () => void = () =>
        ErrataDialogController.showDialog(appState, props.questionNumber, props.questionType);

    return (
        <ThemeContext.Consumer>
            {(theme) => {
                const classes: IErrataButtonClassNames = getClassNames(theme, erratum != undefined);

                return (
                    <IconButton
                        ariaLabel={tooltip}
                        className={classes.errataButton}
                        iconProps={errataIconProps}
                        title={tooltip}
                        onClick={onClick}
                    />
                );
            }}
        </ThemeContext.Consumer>
    );
});

export interface IErrataButtonProps {
    questionNumber: number;
    questionType: QuestionType;
}

interface IErrataButtonClassNames {
    errataButton: string;
}

const getClassNames = memoizeFunction(
    (theme: ITheme | undefined, hasErratum: boolean): IErrataButtonClassNames =>
        mergeStyleSets({
            errataButton: [
                {
                    display: "inline",
                    "&:hover": {
                        opacity: 1,
                    },
                },
                hasErratum
                    ? {
                          color: theme ? theme.palette.themePrimary : "rgba(0, 90, 158)",
                          "&:hover": {
                              color: theme ? theme.palette.themePrimary : "rgba(0, 90, 158)",
                          },
                      }
                    : {
                          opacity: 0.6,
                      },
            ],
        })
);

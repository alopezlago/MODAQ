import * as gameFormats from "./src/state/GameFormats";
import * as qbj from "./src/qbj/QBJ";
import { IFormattedText as iFormattedText } from "./src/parser/IFormattedText";
import { IGameFormat as gameFormat } from "./src/state/IGameFormat";
import { IBonus as bonus, IPacket as packet, ITossup as tossup } from "./src/state/IPacket";
import { IPlayer as player } from "./src/state/TeamState";
import { ModaqControl as control, IModaqControlProps as controlProps } from "./src/components/ModaqControl";
import {
    IFormattingOptions as iFormattingOptions,
    parseFormattedText as ftpParseFormattedText,
    splitFormattedTextIntoWords as ftpSplitFormattedTextIntoWords,
    defaultPronunciationGuideMarkers as ftpDefaultPronunciationGuideMarkers,
    defaultReaderDirectives as ftpDefaultReaderDirectives,
} from "./src/parser/FormattedTextParser";
import { IResult } from "./src/IResult";

export const ModaqControl = control;

export type IModaqControlProps = controlProps;

export type IPacket = packet;

export type ITossup = tossup;

export type IBonus = bonus;

export type IPlayer = player;

export type IGameFormat = gameFormat;

export type IFormattingOptions = iFormattingOptions;

export type IFormattedText = iFormattedText;

export const GameFormats = gameFormats;

export const defaultPronunciationGuideMarkers = ftpDefaultPronunciationGuideMarkers;

export const defaultReaderDirectives = ftpDefaultReaderDirectives;

export const parseFormattedText = ftpParseFormattedText;

export const splitFormattedTextIntoWords = ftpSplitFormattedTextIntoWords;

export const parseQbjRegistration = (registrationJson: string): IResult<IPlayer[]> => {
    const parseResult: IResult<IPlayer[]> = qbj.parseRegistration(registrationJson);
    if (!parseResult.success) {
        return parseResult;
    }

    // Make sure we don't copy over a mobx version of the Player class
    const players: IPlayer[] = parseResult.value.map<IPlayer>((player) => {
        return {
            isStarter: player.isStarter,
            name: player.name,
            teamName: player.teamName,
        };
    });

    return {
        success: true,
        value: players,
    };
};

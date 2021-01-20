import React from "react";
import { observer } from "mobx-react";
import { Label, ILabelStyles } from "@fluentui/react";

import { UIState } from "src/state/UIState";
import { Tossup, Bonus, IBonusPart, PacketState } from "src/state/PacketState";
import { AppState } from "src/state/AppState";

export const PacketLoader = observer(
    (props: IPacketLoaderProps): JSX.Element => {
        // TODO: This probably doesn't need to be cached.
        const fileInput: React.MutableRefObject<null> = React.useRef(null);
        const onLoadHandler = React.useCallback((ev: ProgressEvent<FileReader>) => onLoad(ev, props), [props]);
        const uploadHandler = React.useCallback(
            (event: React.ChangeEvent<HTMLInputElement>) => {
                onChange(props, fileInput, onLoadHandler, event);
            },
            [props, onLoadHandler]
        );

        const statusStyles: ILabelStyles = {
            root: {
                color: props.appState.uiState.packetParseStatus?.isError ?? false ? "rgb(128, 0, 0)" : undefined,
            },
        };

        return (
            <div>
                <Label required={true}>Load Packet</Label>
                <input
                    type="file"
                    accept={
                        ".json,.docx,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    }
                    ref={fileInput}
                    onChange={uploadHandler}
                />
                <Label styles={statusStyles}>{props.appState.uiState.packetParseStatus?.status}</Label>
            </div>
        );
    }
);

function onChange(
    props: IPacketLoaderProps,
    fileInput: React.RefObject<HTMLInputElement>,
    onLoadHandler: (ev: ProgressEvent<FileReader>) => void,
    event: React.ChangeEvent<HTMLInputElement>
): void {
    event.preventDefault();
    props.appState.uiState.clearPacketStatus();

    if (fileInput.current?.files == undefined) {
        return;
    }

    const fileReader = new FileReader();
    fileReader.onload = onLoadHandler;

    // docx files should be read as a binaray, while json should be read as text
    const file: File = fileInput.current.files[0];
    if (file.type === "application/json" || file.type === "text/plain") {
        fileReader.readAsText(file);
    } else {
        fileReader.readAsArrayBuffer(file);
    }
}

function onLoad(ev: ProgressEvent<FileReader>, props: IPacketLoaderProps): void {
    // TODO: This should appear in the UI. Maybe set something in UIState.
    if (ev.target == undefined || ev.target.result == undefined) {
        props.appState.uiState.setPacketStatus({ isError: true, status: "Error loading packet: no file uploaded." });
        throw "Error loading packet: no file uploaded.";
    }

    // JSON is returned as a string, docx as a binary
    if (typeof ev.target.result === "string") {
        loadJsonPacket(props, ev.target.result);
        return;
    }

    loadDocxPacket(props, ev.target.result);
}

async function loadDocxPacket(props: IPacketLoaderProps, docxBinary: ArrayBuffer): Promise<void> {
    const requestInfo: RequestInit = {
        method: "POST",
        body: docxBinary,
        mode: "cors",
    };

    props.appState.uiState.setPacketStatus({ isError: false, status: "Contacting parsing service..." });

    try {
        const response: Response = await fetch(
            "https://yetanotherpacketparserazurefunction.azurewebsites.net/api/ParseDocx",
            requestInfo
        );

        if (!response.ok) {
            let errorMessage = "";
            if (response.status == 400) {
                const errorMessageMap: IParsingServiceErrorMessage = await response.json();

                // TODO: This will now send an array of error messages. We should record all of them, and have them appear
                // line by line. Or, alternatively, fetch the top 3/4 and say how many others there are.
                errorMessage = errorMessageMap.errorMessage.join("\n");
            }

            props.appState.uiState.setPacketStatus({
                isError: true,
                status: `Error loading packet: Parsing service returned an error (${response.status}). Message: ${errorMessage}`,
            });
            return;
        }

        const responseJson: string = await response.text();
        loadJsonPacket(props, responseJson);
    } catch (e) {
        const error: Error = e;
        props.appState.uiState.setPacketStatus({
            isError: true,
            status: "Error loading packet: request to parsing service failed. Error: " + error.message,
        });
        console.warn(e);
    }
}

function loadJsonPacket(props: IPacketLoaderProps, json: string): void {
    const uiState: UIState = props.appState.uiState;

    uiState.setPacketStatus({
        isError: false,
        status: "Loading packet...",
    });

    const parsedPacket: IPacket = JSON.parse(json) as IPacket;
    if (parsedPacket.tossups == undefined) {
        uiState.setPacketStatus({
            isError: true,
            status: "Error loading packet: Packet doesn't have a tossups field.",
        });
        return;
    }

    const tossups: Tossup[] = parsedPacket.tossups.map((tossup) => new Tossup(tossup.question, tossup.answer));
    let bonuses: Bonus[] = [];

    if (parsedPacket.bonuses) {
        bonuses = parsedPacket.bonuses.map((bonus, index) => {
            if (bonus.answers.length !== bonus.parts.length || bonus.answers.length !== bonus.values.length) {
                const errorMessage = `Error loading packet: Unequal number of parts, answers, and values for bonus ${index}. Answers #: ${bonus.answers.length}, Parts #: ${bonus.parts.length}, Values #: ${bonus.values.length}`;
                uiState.setPacketStatus({
                    isError: true,
                    status: errorMessage,
                });
                throw errorMessage;
            }

            const parts: IBonusPart[] = [];
            for (let i = 0; i < bonus.answers.length; i++) {
                parts.push({
                    answer: bonus.answers[i],
                    question: bonus.parts[i],
                    value: bonus.values[i],
                });
            }

            return new Bonus(bonus.leadin, parts);
        });
    }

    const packet = new PacketState();
    packet.setTossups(tossups);
    packet.setBonuses(bonuses);

    uiState.setPacketStatus({
        isError: false,
        status: `Packet loaded. ${tossups.length} tossup(s), ${bonuses.length} bonus(es).`,
    });

    props.onLoad(packet);
}

export interface IPacketLoaderProps {
    loadPacketIntoGame?: boolean;
    appState: AppState;

    onLoad(packet: PacketState): void;
}

interface IParsingServiceErrorMessage {
    errorMessage: [string];
}

// TODO: Should this be moved outside of the component? So we can test it
interface IPacket {
    tossups: ITossup[];
    bonuses?: IBonus[];
}

interface ITossup {
    question: string;
    answer: string;
    number: number;
}

interface IBonus {
    leadin: string;
    parts: string[];
    answers: string[];
    number: number;
    values: number[];
}

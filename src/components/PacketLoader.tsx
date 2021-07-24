import React from "react";
import { observer } from "mobx-react-lite";
import { Label, ILabelStyles } from "@fluentui/react";

import * as PacketLoaderController from "src/components/PacketLoaderController";
import { UIState } from "src/state/UIState";
import { PacketState } from "src/state/PacketState";
import { AppState } from "src/state/AppState";
import { FilePicker } from "./FilePicker";
import { IPacket } from "src/state/IPacket";

export const PacketLoader = observer((props: IPacketLoaderProps): JSX.Element | null => {
    const onLoadHandler = React.useCallback((ev: ProgressEvent<FileReader>) => onLoad(ev, props), [props]);
    const uploadHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>, files: FileList | undefined | null) => {
            onChange(props, files, onLoadHandler, event);
        },
        [props, onLoadHandler]
    );

    const statusStyles: ILabelStyles = {
        root: {
            color: props.appState.uiState.packetParseStatus?.isError ?? false ? "rgb(128, 0, 0)" : undefined,
        },
    };

    if (props.appState.uiState.yappServiceUrl == undefined) {
        return null;
    }

    return (
        <div>
            <FilePicker
                accept="application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                buttonText="Load..."
                label="Packet"
                required={true}
                onChange={uploadHandler}
            />
            <Label styles={statusStyles}>{props.appState.uiState.packetParseStatus?.status}</Label>
        </div>
    );
});

function onChange(
    props: IPacketLoaderProps,
    files: FileList | undefined | null,
    onLoadHandler: (ev: ProgressEvent<FileReader>) => void,
    event: React.ChangeEvent<HTMLInputElement>
): void {
    event.preventDefault();
    props.appState.uiState.clearPacketStatus();

    if (files == undefined || files.length === 0) {
        return;
    }

    const fileReader = new FileReader();
    fileReader.onload = onLoadHandler;

    // docx files should be read as a binaray, while json should be read as text
    const file: File = files[0];
    props.appState.uiState.setPacketFilename(file.name);

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
    if (props.appState.uiState.yappServiceUrl == undefined) {
        return;
    }

    const requestInfo: RequestInit = {
        method: "POST",
        body: docxBinary,
        mode: "cors",
    };

    props.appState.uiState.setPacketStatus({ isError: false, status: "Contacting parsing service..." });

    try {
        const response: Response = await fetch(props.appState.uiState.yappServiceUrl, requestInfo);

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
    const packet: PacketState | undefined = PacketLoaderController.loadPacket(props.appState, parsedPacket);
    if (packet == undefined) {
        return;
    }

    props.onLoad(packet);
}

export interface IPacketLoaderProps {
    appState: AppState;
    onLoad(packet: PacketState): void;
}

interface IParsingServiceErrorMessage {
    errorMessage: [string];
}

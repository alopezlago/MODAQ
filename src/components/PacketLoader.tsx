import React from "react";
import { observer } from "mobx-react-lite";

import * as PacketLoaderController from "../components/PacketLoaderController";
import { UIState } from "../state/UIState";
import { PacketState } from "../state/PacketState";
import { AppState } from "../state/AppState";
import { IPacket } from "../state/IPacket";
import { FilePickerWithStatus } from "./FilePickerWithStatus";
import { Label, Stack, StackItem } from "@fluentui/react";

export const PacketLoader = observer(function PacketLoader(props: IPacketLoaderProps): JSX.Element | null {
    const onLoadHandler = React.useCallback((ev: ProgressEvent<FileReader>) => onLoad(ev, props), [props]);
    const uploadHandler = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>, file: File) => {
            onChange(props, file, onLoadHandler, event);
        },
        [props, onLoadHandler]
    );

    if (props.appState.uiState.yappServiceUrl == undefined) {
        return null;
    }

    const warnings: JSX.Element[] = (props.appState.uiState.packetParseStatus?.warnings ?? []).map((warning) => (
        <StackItem key={warning}>
            <Label>Warning: {warning}</Label>
        </StackItem>
    ));

    return (
        <div>
            <Stack>
                <StackItem>
                    <FilePickerWithStatus
                        accept="application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        buttonText="Load..."
                        label="Packet"
                        required={true}
                        status={props.appState.uiState.packetParseStatus?.status}
                        onChange={uploadHandler}
                    />
                </StackItem>
                {warnings}
            </Stack>
        </div>
    );
});

function onChange(
    props: IPacketLoaderProps,
    file: File,
    onLoadHandler: (ev: ProgressEvent<FileReader>) => void,
    event: React.ChangeEvent<HTMLInputElement> | React.DragEvent
): void {
    event.preventDefault();
    props.appState.uiState.clearPacketStatus();

    const fileReader = new FileReader();
    fileReader.onload = onLoadHandler;

    // docx files should be read as a binary, while json should be read as text
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
                errorMessage = errorMessageMap.errorMessages.join("\r\n");
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
        const error: Error = e as Error;
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

    let parsedPacket: IPacket;
    try {
        parsedPacket = JSON.parse(json) as IPacket;
    } catch (e) {
        uiState.setPacketStatus({
            isError: true,
            status: `Error loading packet: packet is in an invalid format. Error: '${(e as Error).message}'`,
        });
        return;
    }

    const existingPacketName: string | undefined = props.updateFilename
        ? uiState.packetFilename
        : props.appState.game.packet.name;
    const packet: PacketState | undefined = PacketLoaderController.loadPacket(parsedPacket, existingPacketName);
    if (packet == undefined) {
        return;
    }

    props.onLoad(packet);
}

export interface IPacketLoaderProps {
    appState: AppState;
    updateFilename?: boolean;
    onLoad(packet: PacketState): void;
}

interface IParsingServiceErrorMessage {
    errorMessages: [string];
}

import React from "react";
import * as ReactDOM from "react-dom";

import { ModaqControl } from "../components/ModaqControl";

// This will be filled in by vite. This won't be used by people using the library
declare const __BUILD_VERSION__: string;

// If you want a different Google Sheets ID, replace this with your own
const demoGoogleClientId = "1038902414768-nj056sbrbe0oshavft2uq9et6tvbu2d5.apps.googleusercontent.com";
const demoYappService = "https://www.quizbowlreader.com/yapp/api/parse?modaq=true";

window.onload = () => {
    // This element might not exist when running tests. In that case, skip rendering the application.
    const element: HTMLElement | null = document.getElementById("root");
    if (element) {
        ReactDOM.render(
            <ModaqControl
                buildVersion={__BUILD_VERSION__}
                googleClientId={demoGoogleClientId}
                yappServiceUrl={demoYappService}
            />,
            document.getElementById("root")
        );
    }
};

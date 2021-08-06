// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ModaqControl } from "../components/ModaqControl";

declare const __BUILD_VERSION__: string;
declare const __GOOGLE_CLIENT_ID__: string;
declare const __YAPP_SERVICE__: string;

window.onload = () => {
    // This element might not exist when running tests. In that case, skip rendering the application.
    const element: HTMLElement | null = document.getElementById("root");
    if (element) {
        ReactDOM.render(
            <ModaqControl
                buildVersion={__BUILD_VERSION__}
                googleClientId={__GOOGLE_CLIENT_ID__}
                yappServiceUrl={__YAPP_SERVICE__}
            />,
            document.getElementById("root")
        );
    }
};

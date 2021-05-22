// Recommendation is to have separate stores for the UI and for different domains. See https://mobx.js.org/best/store.html

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ModaqControl } from "./components/ModaqControl";

// This element might not exist when running tests. In that case, skip rendering the application.
const element: HTMLElement | null = document.getElementById("root");
if (element) {
    ReactDOM.render(<ModaqControl />, document.getElementById("root"));
}

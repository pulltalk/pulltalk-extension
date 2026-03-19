import { installChromeMock } from "./chrome.mock";

// Provide a baseline chrome mock for every test so modules that
// reference `chrome.*` at import time don't throw.
installChromeMock();

// Build variables defined in webpack have to be defined here, unless we want to test the webpack bundle explicitly
// Otherwise, tests fail because these globals won't be defined

global.__BUILD_VERSION__ = "Test";
global.__GOOGLE_CLIENT_ID__ = "1";
global.__YAPP_SERVICE__ = "https://localhost/api/ParseDocx";

let loggedIn = false;
let popupsFixed = false;
const DOMAIN = 'churchofjesuschrist.org';
const LOGIN_COOKIE_NAME = 'lds-id';

function getLoggedIn() {
  return loggedIn;
}

function unfixPopups() {
  console.log("unfixPopups");
  popupsFixed = false;
}

function updatePopup(newLoggedIn) {
  if (newLoggedIn === loggedIn) {
    return;
  }
  if (newLoggedIn) {
    console.log("logged in");
    loggedIn = true;
    if (!popupsFixed) {
      console.log("set popup to main");
      chrome.browserAction.setPopup({popup: "main_popup.html"});
    }
  } else {
    console.log("logged out");
    loggedIn = false;
    if (!popupsFixed) {
      console.log("set popup to login");
      chrome.browserAction.setPopup({popup: "login_popup.html"});
    }
  }
}

chrome.cookies.onChanged.addListener(changeInfo => {
  const cookie = changeInfo.cookie;
  console.debug("Processing cookie:");
  // console.debug(cookie);
  if (cookie.name === "lds-id" && cookie.domain === `.${DOMAIN}`) {
    console.debug('Processing lds-id cookie');
    updatePopup(!(changeInfo.removed));
  }
});
console.debug("added cookie listener");

chrome.cookies.get({
  url: `https://www.${DOMAIN}`,
  name: LOGIN_COOKIE_NAME
},
cookie => {
  if (cookie !== null) {
    console.log("Found lds-id cookie on startup");
    loggedIn = true;
    chrome.browserAction.setPopup({popup: "main_popup.html"});
    console.log("set popup to main");
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === "getLoggedIn") {
    console.debug("sending loggedIn to popup");
    sendResponse(loggedIn);
  } else if (request.type === "fixPopups") {
    console.log("fixing popups");
    popupsFixed = true;
    sendResponse(true);
  } else if (request.type === "unfixPopups") {
    console.log("unfixing popups");
    popupsFixed = false;
    chrome.cookies.get({
      url: `https://www.${DOMAIN}`,
      name: LOGIN_COOKIE_NAME
    },
    cookie => {
      if (cookie === null) {
        console.log("We are now logged out");
        // loggedIn should already be true
        console.debug(loggedIn);
        chrome.browserAction.setPopup({popup: "login_popup.html"});
      }
    });
    sendResponse(true);
  } else {
    console.log("Received request of unknown type:");
    console.log(request);
    console.log(sender);
  }
});

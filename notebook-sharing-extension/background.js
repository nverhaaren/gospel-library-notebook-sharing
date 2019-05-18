let token = null;
let popupsFixed = false;

function updateToken(changeInfo) {
    const cookie = changeInfo.cookie;
    // console.log("Processing cookie:");
    if (cookie.name === "ObSSOCookie" && cookie.domain === ".lds.org") {
	if (changeInfo.removed || cookie.value === "loggedoutcontinue") {
	    console.log("clearing token");
	    token = null;
	    if (!popupsFixed) {
		chrome.browserAction.setPopup({popup: "login_popup.html"});
	    }
	} else {
	    console.log("setting token");
	    token = cookie.value;
	    if (!popupsFixed) {
		chrome.browserAction.setPopup({popup: "main_popup.html"});
	    }
	}
    }
}

chrome.cookies.onChanged.addListener(updateToken);
console.log("added cookie listener");

chrome.cookies.get({'url': 'https://www.lds.org', 'name': 'ObSSOCookie'}, function(cookie) {
	if (cookie !== null && cookie !== undefined && cookie.value !== "loggedoutcontinue") {
	    console.log("Found cookie on startup");
	    token = cookie.value;
	    chrome.browserAction.setPopup({popup: "main_popup.html"});
	}
    });

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.type === "getToken") {
	    console.log("sending token to popup");
	    sendResponse({"token": token});
	} else if (request.type === "fixPopup") {
	    console.log("fixing popups");
	    popupsFixed = true;
	    sendResponse(true);
	} else {
	    console.log("Received request of unknown type:");
	    console.log(request);
	    console.log(sender);
	}
    });


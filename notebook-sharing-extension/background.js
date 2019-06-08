let loggedIn = false;
const DOMAIN = 'churchofjesuschrist.org';
const LOGIN_COOKIE_NAME = 'lds-id';
function getLoggedIn() {
  return loggedIn;
}

function updatePopup(newLoggedIn) {
  if (newLoggedIn === loggedIn) {
    return;
  }
  if (newLoggedIn) {
    console.log('logged in');
    loggedIn = true;
    console.log('set popup to main');
    chrome.browserAction.setPopup({popup: 'main_popup.html'});
  } else {
    console.log('logged out');
    loggedIn = false;
    console.log('set popup to login');
    chrome.browserAction.setPopup({popup: 'login_popup.html'});
  }
}

chrome.cookies.onChanged.addListener(changeInfo => {
  const cookie = changeInfo.cookie;
  console.debug('Processing cookie:');
  // console.debug(cookie);
  if (cookie.name === 'lds-id' && cookie.domain === `.${DOMAIN}`) {
    console.debug('Processing lds-id cookie');
    updatePopup(!(changeInfo.removed));
  }
});
console.debug('added cookie listener');

chrome.cookies.get({
  url: `https://www.${DOMAIN}`,
  name: LOGIN_COOKIE_NAME
},
cookie => {
  if (cookie !== null) {
    console.log('Found lds-id cookie on startup');
    updatePopup(true);
    console.log('set popup to main');
  }
});

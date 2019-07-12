const openLogin = document.getElementById('openLogin');
console.log('In login_popup.js');

openLogin.onclick = element => {
  console.debug('About to open tab');
  const urlGoto = `https%3a%2f%2fwww.${DOMAIN}%2f`;
  const url = `https://signin.${DOMAIN}/signinRedirect?goto=${urlGoto}`;
  chrome.tabs.create({url, active: true});
};

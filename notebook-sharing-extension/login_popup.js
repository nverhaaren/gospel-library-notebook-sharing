const openLogin = document.getElementById('openLogin');
console.log('In login_popup.js');

openLogin.onclick = element => {
  console.debug('About to open tab');
  chrome.tabs.create({
    url: 'https://signin.lds.org/signinRedirect?goto=https%3a%2f%2fwww.lds.org%2f',
    active: true,
  });
};

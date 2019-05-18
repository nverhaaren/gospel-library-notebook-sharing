const openLogin = document.getElementById("openLogin");
console.log("In login_popup.js");

openLogin.onclick = function(element) {
    console.log("About to open tab");
    chrome.tabs.create({
	    "url": "https://ident.lds.org/sso/UI/Login",
	    "active": true,
	});
};

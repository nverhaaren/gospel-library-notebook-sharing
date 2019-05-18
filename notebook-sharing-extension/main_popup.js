console.log("In main_popup.js");

function appendCheckbox(formElement, notebook) {
    div = document.createElement('div');

    checkboxId = 'notebook_' + notebook.id;
    checkbox = document.createElement('input');
    checkbox.setAttribute("type", 'checkbox');
    checkbox.setAttribute('id', checkboxId);
    checkbox.setAttribute('name', notebook.name);

    div.appendChild(checkbox);

    label = document.createElement('label');
    label.setAttribute('for', checkboxId);
    label.innerText = notebook.name;

    div.appendChild(label);

    formElement.appendChild(div);

    return div;
}


const notebookSelection = document.getElementById("notebookSelection");

const fixedPromise = new Promise((resolve, reject) => {
	try{
	    chrome.runtime.sendMessage({"type": "fixPopup"}, response => {
		    if (!response) {
			console.log("failed to fix popup");
		    } else {
			resolve(null);
		    }
		});
	} catch(error) {
	    reject(error)
	}
    });

const ready = Promise.all([fixedPromise]);
	
ready.then(_ => fetch("https://www.lds.org/notes/api/v2/folders", {"credentials": "same-origin"}))
     .then(response => response.json())
    .then(json => {json.forEach(notebook => appendCheckbox(notebookSelection, notebook));})
     .catch(error => console.log(error));

console.log("Created form");

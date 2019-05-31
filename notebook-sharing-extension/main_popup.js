console.log("In main_popup.js");

const downloadButton = document.getElementById("downloadButton");
const notebookSelection = document.getElementById("notebookSelection");
const selectAll = document.getElementById("selectAll");

// Functions for inspecting UI
function getNotebookCheckboxes() {
  divs = Array.from(notebookSelection.childNodes).filter(element => element.tagName === "DIV");
  console.debug(divs);
  notebooks = divs
  .map(element => element.firstElementChild)
  .filter(element => element.tagName === 'INPUT' && element.type === 'checkbox')
  .filter(element => element.id.slice(0, 'notebook_'.length) === 'notebook_');
  return notebooks;
}

function getSelectedNotebooks() {
  getNotebookCheckboxes()
  .filter(element => element.checked)
  .map(element => element.id.replace('notebook_', ''));
  return notebookIds;
}

function onCheckboxChange(event) {
  const target = event.target;
  if (target.id === 'selectAll') {
    console.log('selectAll');
    console.log(target);
  } else {
    notebooks = getNotebookCheckboxes();
    console.log('notebooks');
    console.log(notebooks);
  }
}

selectAll.onchange = onCheckboxChange;

// Function to help build dynamic UI elements

function appendCheckbox(formElement, notebook) {
  if (notebook.id === '') {
    return null;
  }

  div = document.createElement('div');

  checkboxId = 'notebook_' + notebook.id;
  checkbox = document.createElement('input');
  checkbox.setAttribute("type", 'checkbox');
  checkbox.setAttribute('id', checkboxId);
  checkbox.setAttribute('name', notebook.name);
  checkbox.onchange = onCheckboxChange;

  div.appendChild(checkbox);

  label = document.createElement('label');
  label.setAttribute('for', checkboxId);
  labelText = notebook.name + ' (' + notebook.annotationCount.toString() + ')';
  label.innerText = labelText;
  lastUsed = new Date(notebook.lastUsed).toDateString();
  label.setAttribute('title', 'Last updated: ' + lastUsed);


  div.appendChild(label);

  formElement.insertBefore(div, downloadButton);

  return div;
}

// Functions for performing download

async function fetchNotebook(notebookJson) {
  urlBase = "https://www.lds.org/notes/api/v2/annotations?";
  numberRemaining = notebookJson.annotationCount;
  numberReturned = 0;
  annotations = [];
  while (numberRemaining > 0) {
    numberToReturn = numberRemaining.toString();
    url = urlBase + "folderId=" + notebookJson.id + "&";
    url += "numberToReturn=" + numberToReturn + "&";
    url += "start=" + (numberReturned + 1).toString() + "&";
    url += "type=highlight%2Cjournal%2Creference";
    result = await fetch(url, {credentials: "same-origin"}).then(response => response.json());
    console.debug('fetchNotebook result:');
    console.debug(result);
    annotations = annotations.concat(result);
    numberRemaining -= result.length;
  }
  console.debug('fetchNotebook annotations:');
  console.debug(annotations);
  return annotations;
}

// TODO: is this fixing thing actually helpful, and should how it works be changed?
// note - even if the popup is changed that doesn't close the popup. So maybe not helpful.

const bgPage = chrome.extension.getBackgroundPage();

window.addEventListener("unload", event => {
  bgPage.unfixPopups();
});

// Delay until popups fixed

const fixedPromise = new Promise((resolve, reject) => {
  try {
    chrome.runtime.sendMessage({type: "fixPopups"}, response => {
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

// Display list when ready

let notebooksJson = null;

ready
.then(_ => fetch("https://www.lds.org/notes/api/v2/folders", {credentials: "same-origin"}))
.then(response => {console.log('response:'); console.log(response); return response.json();})
.then(json => {
  notebooksJson = json;
  json.forEach(notebook => appendCheckbox(notebookSelection, notebook));
  if (json.length == 0) {
    noNotebooks = document.createElement('p');
    noNotebooks.setAttribute('class', 'note');
    noNotebooks.innerText = 'You have no notebooks';

    notebookSelection.insertBefore(noNotebooks, downloadButton);
  }
  return json.length
})
.then(count => {
  notebookSelection.insertBefore(document.createElement('hr'), downloadButton);
  return count;
})
.then(count => {
  if (count !== 0) {
    downloadButton.removeAttribute('disabled')
  }
})
.catch(error => {
  console.log(error);
  bgPage.unfixPopups();
  bgPage.updatePopup(false);
  window.location.replace(chrome.runtime.getURL('login_popup.html'));
});

console.log("Created form");

// Set button behavior

downloadButton.onclick = event => {
  console.log("About to initiate download");

  // find selected notebooks
  if (notebooksJson === null) {
    throw Error('download button was clicked with no notebook data loaded');
  }
  let notebooksJsonById = {};
  console.debug("notebooksJsonById:");
  console.debug(notebooksJsonById);
  notebooksJson.forEach(notebookJson => {
    notebooksJsonById[notebookJson.id] = notebookJson
  });
  selectedIds = getSelected(notebookSelection);
  console.debug(selectedIds);
  let selectedNotebooksJson = [];
  selectedIds.forEach(notebookId => {selectedNotebooksJson.push(notebooksJsonById[notebookId])});
  console.debug("selectedNotebooksJson:");
  console.debug(selectedNotebooksJson);

  // Look up annotations
  notebooksAnnotations = selectedIds
  .map(notebookId => notebooksJsonById[notebookId])
  .map(notebookJson => fetchNotebook(notebookJson));
  notebooksAnnotations = Promise.all(notebooksAnnotations);

  // Aggregate
  retVal = notebooksAnnotations.then(notebooks => {
    let aggregateAnnotations = {};
    notebooks.forEach(annotations => {
      console.debug("annotations:");
      console.debug(annotations);
      annotations.forEach(annotation => {
        const annotationId = annotation.id;
        console.debug("annotationId:");
        console.debug(annotationId);
        if (!(annotationId in aggregateAnnotations)) {
          aggregateAnnotations[annotationId] = annotation;
        }
      });
      console.debug('aggregateAnnotations:');
      console.debug(aggregateAnnotations);
      return aggregateAnnotations;
    })
    return aggregateAnnotations;
  }).then(aggregateAnnotations => {
    const finalResult = {
      notebooks: selectedNotebooksJson,
      annotations: aggregateAnnotations,
      version: '0.2'
    }
    console.log('finalResult:')
    console.log(finalResult);
    return finalResult;
  }).then(finalResult => {
    const resultBlob = new Blob([JSON.stringify(finalResult, null, 4)], {type: 'application/json'});
    blobURL = window.URL.createObjectURL(resultBlob);
    chrome.downloads.download({url: blobURL, filename: 'notebooks.json', saveAs: true});
    console.log('Download complete');
  })
}

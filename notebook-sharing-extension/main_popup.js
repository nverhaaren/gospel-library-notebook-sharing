console.log('In main_popup.js');

const downloadButton = $('#downloadButton');
const notebookSelection = $('#notebookSelection');
const selectAll = $('#selectAll');

// Functions for inspecting UI
function getNotebookCheckboxes() {
  const checkboxes = notebookSelection.find('div>input:checkbox');
  console.debug(checkboxes);
  const notebooks = checkboxes
  .filter((_, element) => element.id.slice(0, 'notebook_'.length) === 'notebook_');
  console.debug(notebooks);
  return notebooks;
}

function getSelectedNotebooks() {
  notebookIds = getNotebookCheckboxes()
  .filter(':checked')
  .map((_, element) => element.id.replace('notebook_', ''));
  return notebookIds.toArray();
}

function onCheckboxChange(event) {
  console.debug(event);
  const target = event.target;
  console.debug('target:');
  console.debug(target);
  notebooks = getNotebookCheckboxes();
  if (target.id === 'selectAll') {
    console.debug('selectAll');
    console.debug(target);
    if (target.checked) {
      notebooks.attr('checked', 'checked');
    } else {
      notebooks.removeAttr('checked');
    }
  } else {
    if (notebooks.toArray().every(checkbox => checkbox.checked)) {
      selectAll.attr('checked', 'checked');
    } else if (notebooks.toArray().every(checkbox => !(checkbox.checked))) {
      selectAll.removeAttr('checked');
    }
    console.log('notebooks');
    console.log(notebooks);
  }
}

selectAll.change(onCheckboxChange);

// Function to help build dynamic UI elements

function addCheckbox(notebook) {
  if (notebook.id === '') {
    return null;
  }

  div = $('<div>').insertBefore(downloadButton);

  checkboxId = 'notebook_' + notebook.id;
  checkbox = $('<input>', {
    type: 'checkbox',
    id: checkboxId,
    name: notebook.name,
  }).change(onCheckboxChange);

  div.append(checkbox);

  lastUsed = new Date(notebook.lastUsed).toDateString();
  label = $('<label>', {
    for: checkboxId,
    text: `${notebook.name} (${notebook.annotationCount})`,
    title: `Last updated: ${lastUsed}`,
  });

  div.append(label);

  return div;
}

// Function for performing download

async function fetchNotebook(notebookJson) {
  urlBase = 'https://www.lds.org/notes/api/v2/annotations?';
  numberRemaining = notebookJson.annotationCount;
  numberReturned = 0;
  annotations = [];
  while (numberRemaining > 0) {
    numberToReturn = numberRemaining.toString();
    url = urlBase + `folderId=${notebookJson.id}&`;
    url += `numberToReturn=${numberToReturn}&`;
    url += `start=${numberReturned + 1}&`;
    url += 'type=highlight%2Cjournal%2Creference';
    result = await fetch(url, {credentials: 'same-origin'}).then(response => response.json());
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

window.onunload = event => {
  bgPage.unfixPopups();
};

// Delay until popups fixed

const fixedPromise = new Promise((resolve, reject) => {
  try {
    chrome.runtime.sendMessage({type: 'fixPopups'}, response => {
      if (!response) {
        console.log('failed to fix popup');
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
.then(_ => fetch('https://www.lds.org/notes/api/v2/folders', {credentials: 'same-origin'}))
.then(response => {
  // console.debug('response:'); console.debug(response);
  return response.json();})
.then(json => {
  notebooksJson = json;
  json.forEach(notebook => addCheckbox(notebook));
  if (json.length == 0) {
    noNotebooks = $('<p>', {'class': 'note', text: 'You have not notebooks'});
    downloadButton.before(noNotebooks);
  }
  return json.length
})
.then(count => {
  downloadButton.before($('<hr>'))
  return count;
})
.then(count => {
  if (count !== 0) {
    downloadButton.removeAttr('disabled');
  }
})
.catch(error => {
  console.log(error);
  console.log()
  bgPage.unfixPopups();
  bgPage.updatePopup(false);
  window.location.replace(chrome.runtime.getURL('login_popup.html'));
});

console.log('Created form');

// Set button behavior

downloadButton.click(event => {
  console.log('About to initiate download');

  // find selected notebooks
  if (notebooksJson === null) {
    throw Error('download button was clicked with no notebook data loaded');
  }
  let notebooksJsonById = {};
  console.debug('notebooksJsonById:');
  console.debug(notebooksJsonById);
  notebooksJson.forEach(notebookJson => {
    notebooksJsonById[notebookJson.id] = notebookJson
  });
  selectedIds = getSelectedNotebooks();
  console.debug(selectedIds);
  let selectedNotebooksJson = [];
  selectedIds.forEach(notebookId => {selectedNotebooksJson.push(notebooksJsonById[notebookId])});
  console.debug('selectedNotebooksJson:');
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
      console.debug('annotations:');
      console.debug(annotations);
      annotations.forEach(annotation => {
        const annotationId = annotation.id;
        console.debug('annotationId:');
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
      version: '0.3',
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
});

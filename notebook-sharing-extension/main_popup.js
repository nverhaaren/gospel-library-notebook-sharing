const DOMAIN = 'churchofjesuschrist.org';
const VERSION = '0.3.2';
console.log('In main_popup.js');

const downloadButton = $('#downloadButton');
const annotationSelection = $('#annotationSelection');
const selectAll = $('#selectAll');

// Functions for inspecting UI
function getNotebookCheckboxes() {
  const checkboxes = annotationSelection.find('div>input:checkbox');
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
      downloadButton.removeAttr('disabled');
    } else {
      notebooks.removeAttr('checked');
      if ($('#unassignedAnnotations:checked').length === 0) {
        downloadButton.attr('disabled', 'disabled');
      }
    }
  } else if (target.id === 'unassignedAnnotations') {
    console.debug('unassignedAnnotations');
    console.debug(target);
    if (target.checked) {
      downloadButton.removeAttr('disabled');
    } else if (notebooks.toArray().every(checkbox => !(checkbox.checked))) {
      downloadButton.attr('disabled', 'disabled');
    }
  } else {
    if (notebooks.toArray().every(checkbox => !(checkbox.checked))) {
      selectAll.removeAttr('checked');
      if ($('#unassignedAnnotations:checked').length === 0) {
        downloadButton.attr('disabled', 'disabled');
      }
    } else {
      downloadButton.removeAttr('disabled');
      if (notebooks.toArray().every(checkbox => checkbox.checked)) {
        selectAll.attr('checked', 'checked');
      }
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

  div = $('<div>').insertBefore(downloadButton).addClass('selectionLine');

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

let notesUpperBound = 0;

async function fetchNotebook(notebookJson) {
  urlBase = `https://www.${DOMAIN}/notes/api/v2/annotations?`;
  let numberRemaining = null;
  if (notebookJson !== null) {
    numberRemaining = notebookJson.annotationCount;
  } else {
    numberRemaining = notesUpperBound;
  }
  numberReturned = 0;
  annotations = [];
  while (numberRemaining > 0) {
    numberToReturn = numberRemaining;
    url = urlBase;
    if (notebookJson !== null) {
      url += `folderId=${notebookJson.id}&`;
    }
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

const bgPage = chrome.extension.getBackgroundPage();

// ready is trivial for now
const ready = Promise.resolve();

// Display list when ready

let notebooksJson = null;

ready
.then(_ => fetch(`https://www.${DOMAIN}/notes/api/v2/folders`, {credentials: 'same-origin'}))
.then(response => {
  // console.debug('response:'); console.debug(response);
  return response.json();
})
.then(json => {
  if (json.length === 0) {
    const noNotebooks = $('<p>', {text: 'You have no notebooks'})
    .addClass('note');
    downloadButton.before(noNotebooks);
    return null;
  }

  notebooksJson = json;
  let unassigned = null;
  let trueNotebookCount = 0;
  json.forEach(notebook => {
    if (notebook.id === '') {
      unassigned = notebook.annotationCount;
    } else {
      trueNotebookCount++;
    }
    notesUpperBound += notebook.annotationCount;
    addCheckbox(notebook);
  });
  if (trueNotebookCount === 0) {
    const noNotebooks = $('<p>', {text: 'You have no notebooks'})
    .addClass('note');
    downloadButton.before(noNotebooks);
  }

  if (unassigned === null) {
    console.warn('No "Unassigned Items" notebook');
    unassigned = 0;
  }
  return unassigned;
})
.then(unassigned => {
  downloadButton.before($('<hr>'));
  return unassigned;
})
.then(unassigned => {
  if (unassigned === null || unassigned === 0) {
    noUnassigned = $('<p>', {text: 'You have no unassigned annotations'})
    .addClass('note');
    downloadButton.before(noUnassigned);
    return null;
  }

  div = $('<div>').insertBefore(downloadButton).addClass('selectionLine');

  checkbox = $('<input>', {
    type: 'checkbox',
    id: 'unassignedAnnotations',
    name: 'unassignedAnnotations',
  }).change(onCheckboxChange);

  div.append(checkbox);

  label = $('<label>', {
    for: 'unassignedAnnotations',
    text: `Include all annotations (${unassigned} not assigned to any notebook)`,
  });

  div.append(label);
})
.then(_ => downloadButton.before($('<hr>')))
.then(_ => annotationSelection.removeAttr('hidden'))
.catch(error => {
  // console.log(error);
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

  let notebooksAnnotations = null;
  // Look up annotations
  if ($('#unassignedAnnotations:checked').length > 0) {
    fetchAnnotations = fetchNotebook(null);
  } else {
    notebooksAnnotations = selectedIds
    .map(notebookId => notebooksJsonById[notebookId])
    .map(notebookJson => fetchNotebook(notebookJson));
    notebooksAnnotations = Promise.all(notebooksAnnotations);

    fetchAnnotations = notebooksAnnotations.then(notebooks => {
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
    })
  }

  // Aggregate
  fetchAnnotations.then(aggregateAnnotations => {
    const finalResult = {
      notebooks: selectedNotebooksJson,
      annotations: aggregateAnnotations,
      version: VERSION,
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

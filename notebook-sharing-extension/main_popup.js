const DOMAIN = 'churchofjesuschrist.org';
const VERSION = '0.4';
console.log('In main_popup.js');

class NotebookManager {
  // TODO: use private fields when there is broader compatability
  _downloadButton: $('#downloadButton');
  _annotationSelection: $('#annotationSelection');
  _selectAll: $('#selectAll');

  constructor() {
    this._notebooks = {};
    this._notebookAnnotationCount = {};
    this._unassignedNotebook = null;
  }

  get downloadButton() {
    return this._downloadButton;
  }

  get annotationSelection() {
    return this._annotationSelection;
  }

  get selectAll() {
    return this._selectAll;
  }

  get notebooks() {
    return this._notebooks;
  }

  get notebookAnnotationCount() {
    return this._notebookAnnotationCount;
  }

  get unassignedNotebook() {
    return this._unassignedNotebook;
  }

  // jQuery selection of elements
  get notebookCheckboxes() {
    const checkboxes = this.annotationSelection.find('div>input:checkbox');
    console.debug(checkboxes);
    const notebooks = checkboxes
      .filter((_, element) =>
              element.id.slice(0, 'notebook_'.length) === 'notebook_');
    console.debug(notebooks);
    return notebooks;
  }

  // array of bool
  get selectedVector() {
    return this.notebookCheckboxes.toArray().map(checkbox => checkbox.checked);
  }

  // Array of strings
  get selectedNotebookIds() {
    notebookIds = this.notebookCheckboxes
      .filter(':checked')
      .map((_, element) => element.id.replace('notebook_', ''));
    return notebookIds.toArray();
  }

  get nonemptySelection() {
    return this.selectedNotebookIds.length !== 0;
  }

  _changeWrapper(onChangeFn) {
    return event => {
      console.debug(event);
      const target = event.target;
      console.debug('target:');
      console.debug(target);

      onChangeFn(event);
      updateDownloadButton();
    };
  }

  _onNotebookCheckboxChange(event) {
    console.debug('selectedVector:');
    console.debug(selectedVector);
    if (this.selectedVector.every(x => x)) {
      selectAll.attr('checked', 'checked');
      return;
    }
    if (this.selectedVector.every(x => !x)) {
      selectAll.removeAttr('checked');
    }
  }

  _onSelectAllChange(event) {
    target = event.target;
    if (target.checked) {
      this.notebookCheckboxes.attr('checked', 'checked');
    } else {
      this.notebookCheckboxes.removeAttr('checked');
    }
  }

  _onUnassignedCheckboxChange(event) {}

  addCheckbox(notebook) {
    // console.debug(notebook);
    if (notebook.id === '') {
      if (this.unassignedNotebook !== null) {
        throw Error('found multiple unassigned notebooks');
      }
      this._unassignedNotebook = notebook;
      return null;
    }

    this._notebooks[notebook.id] = notebook;

    div = $('<div>')
      .insertBefore(this.downloadButton)
      .addClass('selectionLine');

    checkboxId = 'notebook_' + notebook.id;
    checkbox = $('<input>', {
      type: 'checkbox',
      id: checkboxId,
      name: notebook.name,
    }).change(this._changeWrapper(this._onNotebookCheckboxChange));

    div.append(checkbox);

    const annotationCount = 'order' in notebook ? notebook.order.id.length : 0;
    this._notebookAnnotationCount[notebook.id] = annotationCount;
    if (annotationCount !== notebook.annotationCount) {
      console.debug(
        `Number of annotations ${annotationCount} does not match ` +
        `annotationCount ${notebook.annotationCount} ` +
        `for notebook ${notebook.id}`
      );
    }

    lastUsed = new Date(notebook.lastUsed).toDateString();
    label = $('<label>', {
      for: checkboxId,
      text: `${notebook.name} (${annotationCount})`,
      title: `Last updated: ${lastUsed}`,
    });

    div.append(label);

    return div;
  }
}

const notebookManager = new NotebookManager();

notebookManager.selectAll.change(
  notebookManager._changeWrapper(notebookManager._onSelectAllChange)
);
notebookManager.unassignedAnnotations.change(
  notebookManager._changeWrapper(notebookManager._onUnassignedCheckboxChange)
);

function updateDownloadButton() {
  if (notebookManager.nonemptySelection ||
      $('#unassignedAnnotations:checked').length !== 0) {
    downloadButton.attr('disabled', 'disabled');
  } else {
    downloadButton.removeAttr('disabled');
  }
}


// Function for performing download

// TODO: replace notesUpperBound from manager
let notesUpperBound = 0;

async function fetchNotebook(notebookId) {
  urlBase = `https://www.${DOMAIN}/notes/api/v2/annotations?`;
  let numberRemaining = null;
  if (notebookJson !== null) {
    numberRemaining = notebookManager._notebookAnnotationCount[notebookId];
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
  // console.log('About to redirect to login');
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
    fetchAnnotations = fetchNotebook(null).then(allAnnotations => {
      let aggregateAnnotations = {};
      allAnnotations.forEach(annotation => {
        aggregateAnnotations[annotation.id] = annotation;
      });
      return aggregateAnnotations;
    });
  } else {
    notebooksAnnotations = selectedIds
    .map(notebookId => notebooksJsonById[notebookId])
    .map(notebookJson => fetchNotebook(notebookJson));
    notebooksAnnotations = Promise.all(notebooksAnnotations);

    fetchAnnotations = notebooksAnnotations.then(notebooks => {
      let aggregateAnnotations = {};
      notebooks.forEach(annotations => {
        // console.debug('annotations:');
        // console.debug(annotations);
        annotations.forEach(annotation => {
          const annotationId = annotation.id;
          // console.debug('annotationId:');
          // console.debug(annotationId);
          if (!(annotationId in aggregateAnnotations)) {
            aggregateAnnotations[annotationId] = annotation;
          }
        });
        // console.debug('aggregateAnnotations:');
        // console.debug(aggregateAnnotations);
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

const DOMAIN = 'churchofjesuschrist.org';
const VERSION = '0.4';
console.log('In main_popup.js');

class NotebookManager {
  // TODO: use private fields when there is broader compatability
  _downloadButton = $('#downloadButton');
  _annotationSelection = $('#annotationSelection');
  _selectAll = $('#selectAll');

  constructor() {
    this._notebooks = {};
    this._notebookAnnotationCount = {};
    this._unassignedNotebook = null;
    this._totalAnnotationEstimate = 0;
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

  get totalAnnotationEstimate() {
    return this._totalAnnotationEstimate;
  }

  // jQuery selection of elements
  get notebookCheckboxes() {
    const checkboxes = this.annotationSelection.find('div>input:checkbox');
    //console.debug(checkboxes);
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
    const notebookIds = this.notebookCheckboxes
      .filter(':checked')
      .map((_, element) => element.id.replace('notebook_', ''));
    return notebookIds.toArray();
  }

  get selectedNotebooks() {
    let ret = {};
    const notebooks = this.notebooks;
    this.selectedNotebookIds.forEach(notebookId => {
      ret[notebookId] = notebooks[notebookId];
    });
    return ret;
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
    console.log('selectedVector:');
    console.log(this.selectedVector);
    if (this.selectedVector.every(x => x)) {
      this.selectAll.attr('checked', 'checked');
      return;
    }
    if (this.selectedVector.every(x => !x)) {
      this.selectAll.removeAttr('checked');
    }
  }

  _onSelectAllChange(event) {
    console.debug('In _onSelectAllChange:');
    const target = event.target;
    console.debug(this);
    console.debug(this.notebookCheckboxes);
    if (target.checked) {
      this.notebookCheckboxes.attr('checked', 'checked');
    } else {
      this.notebookCheckboxes.removeAttr('checked');
    }
  }

  addCheckbox(notebook) {
    //console.debug('In addCheckbox'); console.debug(notebook);
    if (notebook.id === '') {
      if (this.unassignedNotebook !== null) {
        throw Error('found multiple unassigned notebooks');
      }
      this._unassignedNotebook = notebook;
      this._totalAnnotationEstimate += notebook.annotationCount;
      return null;
    }

    this._notebooks[notebook.id] = notebook;

    const div = $('<div>')
      .insertBefore(this.downloadButton)
      .addClass('selectionLine');

    const checkboxId = 'notebook_' + notebook.id;
    const checkbox = $('<input>', {
      type: 'checkbox',
      id: checkboxId,
      name: notebook.name,
    }).change(this._changeWrapper(event => this._onNotebookCheckboxChange(event)));

    div.append(checkbox);

    const annotationCount = 'order' in notebook ? notebook.order.id.length : 0;
    this._notebookAnnotationCount[notebook.id] = annotationCount;
    this._totalAnnotationEstimate += notebook.annotationCount;
    if (annotationCount !== notebook.annotationCount) {
      console.debug(
        `Number of annotations ${annotationCount} does not match ` +
        `annotationCount ${notebook.annotationCount} ` +
        `for notebook ${notebook.id}`
      );
    }

    const lastUsed = new Date(notebook.lastUsed).toDateString();
    const label = $('<label>', {
      for: checkboxId,
      text: `${notebook.name} (${annotationCount})`,
      title: `Last updated: ${lastUsed}`,
    });

    div.append(label);

    return div;
  }
}

const notebookManager = new NotebookManager();

// This kind of lambda used to just call a method is necessary due to how
// JavaScript does classes (as syntactic sugar)
notebookManager.selectAll.change(
  notebookManager._changeWrapper(event => notebookManager._onSelectAllChange(event))
);

function updateDownloadButton() {
  if (notebookManager.nonemptySelection ||
      $('#unassignedAnnotations:checked').length !== 0) {
    notebookManager.downloadButton.removeAttr('disabled');
  } else {
    notebookManager.downloadButton.attr('disabled', 'disabled');
  }
}

// Functions for performing download
// I don't think this one needs to be async (it already returns a promise) but
// it shouldn't hurt either
async function fetchAnnotations(notebookId, start, numberToReturn) {
  const urlBase = `https://www.${DOMAIN}/notes/api/v2/annotations?`;
  let url = urlBase;
  if (notebookId !== null) {
    url += `folderId=${notebookId}&`;
  }
  url += `numberToReturn=${numberToReturn}&`;
  url += `start=${start}&`;
  url += 'type=highlight%2Cjournal%2Creference';
  const result = fetch(url, {credentials: 'same-origin'}).then(response => response.json());
  console.debug('fetchAnnotations result:');
  console.debug(result);
  return result;
}

async function fetchNotebook(notebookId) {
  let numberRemaining = null;
  if (notebookId !== null) {
    numberRemaining = notebookManager._notebookAnnotationCount[notebookId];
  } else {
    numberRemaining = notebookManager.totalAnnotationEstimate;
  }
  let numberReturned = 0;
  let annotations = [];
  while (true) {
    let numberToReturn = numberRemaining > 0 ? numberRemaining : 50;
    let result = await fetchAnnotations(notebookId, numberReturned + 1, numberToReturn);
    annotations = annotations.concat(result);
    numberRemaining -= result.length;
    numberReturned += result.length;
    if (result.length === 0 || numberRemaining <= 0) {
      let trialResult = await fetchAnnotations(notebookId, numberReturned + 1, 1);
      if (trialResult.length === 0) {
        break;
      }
      annotations = annotations.concat(trialResult);
      numberRemaining -= trialResult.length;
      numberReturned += trialResult.length;
    }
  }
  console.debug('fetchNotebook annotations:');
  console.debug(annotations);
  return annotations;
}

const bgPage = chrome.extension.getBackgroundPage();

// ready is trivial for now
const ready = Promise.resolve();

// Display list when ready
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
    notebookManager.downloadButton.before(noNotebooks);
    return null;
  }

  json.forEach(notebook => {
    notebookManager.addCheckbox(notebook);
  });
  if (notebookManager.notebookCheckboxes.length === 0) {
    const noNotebooks = $('<p>', {text: 'You have no notebooks'})
    .addClass('note');
    notebookManager.downloadButton.before(noNotebooks);
  }

  if (notebookManager.unassignedNotebook === null) {
    console.warn('No "Unassigned Items" notebook');
  }
})
.then(_ => notebookManager.downloadButton.before($('<hr>')))
.then(_ => {
  const unassignedNotebook = notebookManager.unassignedNotebook;
  if (unassignedNotebook === null || unassignedNotebook.length === 0) {
    noUnassigned = $('<p>', {text: 'You have no unassigned annotations'})
    .addClass('note');
    notebookManager.downloadButton.before(noUnassigned);
    return null;
  }

  const div = $('<div>').insertBefore(notebookManager.downloadButton).addClass('selectionLine');

  const unassignedCheckbox = $('<input>', {
    type: 'checkbox',
    id: 'unassignedAnnotations',
    name: 'unassignedAnnotations',
  }).change(updateDownloadButton);

  div.append(unassignedCheckbox);

  const unassignedEstimate = unassignedNotebook !== null ?
                             unassignedNotebook.annotationCount : 0;

  const label = $('<label>', {
    for: 'unassignedAnnotations',
    text: `Include all annotations (about ${unassignedEstimate} not assigned to any notebook)`,
  });

  div.append(label);
})
.then(_ => notebookManager.downloadButton.before($('<hr>')))
.then(_ => notebookManager.annotationSelection.removeAttr('hidden'))
.catch(error => {
  console.log(error);
  console.log('About to redirect to login');
  // bgPage.updatePopup(false);
  // window.location.replace(chrome.runtime.getURL('login_popup.html'));
});

console.log('Created form');

// Set button behavior

notebookManager.downloadButton.click(event => {
  console.log('About to initiate download');

  // find selected notebooks
  if (notebookManager.notebooks === {}) {
    throw Error('download button was clicked with no notebook data loaded');
  }
  console.debug('notebookManager.selectedNotebookIds');
  console.debug(notebookManager.selectedNotebookIds);

  let notebooksAnnotations = null;
  let fetchSelectedAnnotations = null;
  // Look up annotations
  if ($('#unassignedAnnotations:checked').length > 0) {
    fetchSelectedAnnotations = fetchNotebook(null).then(allAnnotations => {
      let aggregateAnnotations = {};
      allAnnotations.forEach(annotation => {
        aggregateAnnotations[annotation.id] = annotation;
      });
      return aggregateAnnotations;
    });
  } else {
    notebooksAnnotations = notebookManager.selectedNotebookIds
    .map(notebookId => fetchNotebook(notebookId));
    notebooksAnnotations = Promise.all(notebooksAnnotations);

    fetchSelectedAnnotations = notebooksAnnotations.then(notebookAnnotations => {
      let aggregateAnnotations = {};
      notebookAnnotations.forEach(annotations => {
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
  fetchSelectedAnnotations.then(aggregateAnnotations => {
    const finalResult = {
      notebooks: notebookManager.selectedNotebooks,
      annotations: aggregateAnnotations,
      version: VERSION,
    }
    console.log('finalResult:');
    console.log(finalResult);
    return finalResult;
  }).then(finalResult => {
    const resultBlob = new Blob([JSON.stringify(finalResult, null, 4)], {type: 'application/json'});
    const blobURL = window.URL.createObjectURL(resultBlob);
    chrome.downloads.download({url: blobURL, filename: 'notebooks.json', saveAs: true});
    console.log('Download complete');
  })
});

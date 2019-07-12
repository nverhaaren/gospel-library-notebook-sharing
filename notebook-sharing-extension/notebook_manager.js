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

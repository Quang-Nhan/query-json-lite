
(function () {
 
  const MAX_LIST_LENGTH = 20;
  const MAX_FAV_LIST_LENGTH = 5;
  const vscode = acquireVsCodeApi();
  const oldState = vscode.getState();
  const pathDom = document.querySelector('.path');
  const pathListDom = document.querySelector('.pathList');
  const favPathListDom = document.querySelector('.favPathList');
  const runTimer = null;
  let isRunRequestDone = true;

  pathDom.value = oldState?.path.length ? oldState?.path : '';

  /**
   * build a new historyPaths state and update html dom when run path is clicked
   */
  const processHistoryPaths = (path, historyPaths) => {
    let pathCopy = path.slice();
    if (!pathCopy.replace(/\n|\r/g, '').trim().length || (vscode.getState()?.favHistoryPaths || []).includes(path)) {
      return historyPaths;
    }
    // remove duplicate html
    historyPaths = historyPaths.filter(val => val !== path);
    historyPaths.push(path);

    if (historyPaths.length > MAX_LIST_LENGTH) {
      historyPaths = historyPaths.slice(0, MAX_LIST_LENGTH);
    }

    let n = 0;
    // remove duplicate paths from html list
    for (let li of pathListDom.children) {
      if (li.firstElementChild.dataset.path.trim() === path.trim() || n >= MAX_LIST_LENGTH-1) {
        li.parentNode.removeChild(li);
      } else {
        n++;
      }
    }
    // add the new pathListItem
    doms.append.pathListItem(path);
    return historyPaths;
  }

  const hints = {
    'codicon-close': 'delete',
    'codicon-star-full': 'remove from favourites',
    'codicon-star-empty': 'add to favourites'
  }

  const doms = {
    create: {
      pathListItem: () => {
        const li = document.createElement('li');
        li.className = 'pathListItem';
        return li;
      },
      icons: () => {
        const div = document.createElement('div');
        div.className = 'icons';
        return div;
      },
      icon: () => {
        const div = document.createElement('div');
        div.className = 'icon';
        return div;
      },
      codicon: (iconClass, handler) => {
        const codIcon = document.createElement('i');
        codIcon.classList = `codicon ${iconClass}`;
        codIcon.title = hints[iconClass];
        codIcon.addEventListener('click', handler);
        return codIcon;
      },
      histPath: (path, isFav) => {
        const div = document.createElement('div');
        // https://www.tutorialspoint.com/how-to-check-if-a-string-is-html-or-not-using-javascript
        if (/<([A-Za-z][A-Za-z0-9]*)((\b[^>]*>((.|(\r?\n))*?)<\/\1>)|(\/\>))/.test(path)) {
          div.innerText = path.replace(/\n|\r/g, '');
        } else {
          div.innerHTML = path;
        }
        div.dataset.path = path;
        div.dataset.fav = isFav ? 'y' : 'n'
        div.className = 'histPath';
        div.addEventListener('click', handlers.histPathClicked);
        return div;
      },
      favPathListItem: () => {
        const li = document.createElement('li');
        li.className = 'favPathListItem';
        return li;
      }
    },
    append: {
      pathListItem: (path) => {
        const li = doms.create.pathListItem();
        const histPathDiv = doms.create.histPath(path);
        const iconsDiv = doms.create.icons();
        const iconDiv1 = doms.create.icon();
        const iconDiv2 = doms.create.icon();
        const starCodIcon = doms.create.codicon('codicon-star-empty', handlers.starPathClicked);
        const closeCodIcon = doms.create.codicon('codicon-close', handlers.removePathClicked);


        iconDiv1.appendChild(starCodIcon);
        iconDiv2.appendChild(closeCodIcon);
        iconsDiv.appendChild(iconDiv1);
        iconsDiv.appendChild(iconDiv2);
        li.appendChild(histPathDiv);
        li.appendChild(iconsDiv);

        pathListDom.insertBefore(li, pathListDom.firstChild);
      },
      favPathListItem: (path) => {
        const li = doms.create.favPathListItem();
        const histPathDiv = doms.create.histPath(path, true);
        const iconsDiv = doms.create.icons();
        const iconDiv = doms.create.icon();
        const unstarCodIcon = doms.create.codicon('codicon-star-full', handlers.unstarPathClicked);

        iconDiv.appendChild(unstarCodIcon);
        iconsDiv.appendChild(iconDiv);
        li.appendChild(histPathDiv);
        li.appendChild(iconsDiv);

        favPathListDom.insertBefore(li, favPathListDom.firstChild);
      }
    },
    feedback: {
      update: (type, message = '') => {
        const feedbackDiv = document.querySelector('#feedback');
        if (type === 'reset') {
          feedbackDiv.innerText = '';
        } else {
          feedbackDiv.innerText = message;
          if (type === 'error') {
            feedbackDiv.classList.remove('warning');
            feedbackDiv.classList.add('error');
          } else if (type === 'warning') {
            feedbackDiv.classList.remove('error');
            feedbackDiv.classList.add('warning');
          }
        }
      }
    },
    spinner: {
      start: () => {
        const spinnerIconDiv = document.querySelector('.codicon-sync');
        spinnerIconDiv.classList.add('spin');
      },
      stop: () => {
        const spinnerIconDiv = document.querySelector('.codicon-sync');
        spinnerIconDiv.classList.remove('spin');
      }
    },
    runButton: {
      enable: () => {
        const runButton = document.querySelector('button.run');
        runButton.disabled = false;
      },
      disable: () => {
        const runButton = document.querySelector('button.run');
        runButton.disabled = true;
      }
    }
  };

  const handlers = {
    /**
     * handler when runPath button is clicked
     */
    runPathClicked: () => {
      try {
        const path = pathDom.value;
        const historyPaths = vscode.getState()?.historyPaths || [];
        
        vscode.setState({
          ...vscode.getState(), 
          path, 
          historyPaths: processHistoryPaths(path, historyPaths)
        });

        vscode.postMessage({
          type: 'run',
          path: path.replace(/\n|\r/g, '')
        });
        
        doms.spinner.start();
        doms.runButton.disable();

        isRunRequestDone = false;
        runTimer = setTimeout((timout) => {
          if (!isRunRequestDone) {
            doms.feedback.update('warning', 'This may take longer for a large file');
          }
        }, 1000);
      } catch(e) {
        // TODO
        // doms.feedback.update('error', 'An unexpected error had occcured');
      }
    },
    /**
     * handler when the histPath div is clicked
     */
    histPathClicked: (event) => {
      if (event.currentTarget.dataset.path.trim().length) {
        if (pathDom.value?.trim() !== event.currentTarget.dataset.path.trim()) {
          doms.feedback.update('reset');
        }
        pathDom.value = event.currentTarget.dataset.path;
        vscode.setState({...vscode.getState(), path: pathDom.value});
      }
    },
    /**
     * handler when the codicon i element is clicked
     */
    removePathClicked: (event) => {
      const state = vscode.getState();
      const iconDiv = event.currentTarget.parentElement;
      const iconsDiv = iconDiv.parentElement;
      const li = iconsDiv.parentElement;
      const histPathDiv = li.querySelector('.histPath');
  
      // remove from state
      vscode.setState({
        ...vscode.getState(),
        [histPathDiv.dataset.fav === 'y' ? 'favHistoryPaths' : 'historyPaths']: 
          ((histPathDiv.dataset.fav === 'y' ? state?.favHistoryPaths : state?.historyPaths )|| []).filter(path => path !== histPathDiv.dataset.path)
      });
  
      // remove from html dom
      li.parentElement.removeChild(li);
      return histPathDiv.dataset.path;
    },
    /**
     * handler to favourite a path
     * moves the normal path hist item to fav path list
     */
    starPathClicked: (event) => {
      const favHistoryPaths = vscode.getState()?.favHistoryPaths || [];
      if (favHistoryPaths.length >= MAX_FAV_LIST_LENGTH) {
        doms.feedback.update('warning', 'A maximum of 5 starred paths are allowed')
        setTimeout(() => {
          doms.feedback.update('reset');
        }, 1600);
        return;
      }

      // remove from historyPath state
      const path = handlers.removePathClicked(event);

      // add it to favHistoryPath state and dom
      if (!favHistoryPaths.includes(path)) {
        vscode.setState({
          ...vscode.getState(),
          favHistoryPaths: [...favHistoryPaths, path]
        });
        doms.append.favPathListItem(path);
      }
    },
    /**
     * handler to unfavourte a path
     * moves the fav path item to normal path hist
     */
    unstarPathClicked: (event) => {
      // remove from favHistoryPath
      const path = handlers.removePathClicked(event);

      // add it to historyPath state and dom
      if (!(vscode.getState()?.historyPaths || []).includes(path)) {
        vscode.setState({
          ...vscode.getState(),
          historyPaths: [...(vscode.getState()?.historyPaths || []), path]
        });
        doms.append.pathListItem(path);
      }
    }
  };
 
  document.querySelector('.run').addEventListener('click', handlers.runPathClicked);
  document.querySelectorAll('.histPath').forEach(histPath => histPath.addEventListener('click', handlers.histPathClicked));
  document.querySelectorAll('.codicon-close').forEach(removeIcon => removeIcon.addEventListener('click', handlers.codIconClicked))
  
  window.addEventListener('message', event => {
    const data = event.data;
    if (data.type === 'done') {
      if (runTimer) {
        clearTimeout(runTimer);
      }
      isRunRequestDone = true;
      // stop spinner
      doms.spinner.stop();
      doms.runButton.enable();
    } else {
      doms.feedback.update(data.type, data.message);
    }
  });

  // dynamically load the pathListItems
  (oldState?.historyPaths || []).forEach(path => {
    doms.append.pathListItem(path);
  });

  // dynamically load the favPathListItems
  (oldState?.favHistoryPaths || []).forEach(path => {
    doms.append.favPathListItem(path)
  })
}());
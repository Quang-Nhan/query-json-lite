
(function () {
 
  const MAX_LIST_LENGTH = 20;
  const vscode = acquireVsCodeApi();
  const oldState = vscode.getState();
  const pathDom = document.querySelector('.path');
  const pathListDom = document.querySelector('.pathList');
  
  pathDom.value = oldState?.path.length ? oldState?.path : '';

  /**
   * build a new historyPaths state and update html dom when run path is clicked
   */
  const processHistoryPaths = (path, historyPaths) => {
    let pathCopy = path.slice();
    if (!pathCopy.replace(/\n|\r/g, '').trim().length) {
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

  const doms = {
    create: {
      pathListItem: () => {
        const li = document.createElement('li');
        li.className = 'pathListItem';
        return li;
      },
      icon: () => {
        const div = document.createElement('div');
        div.className = 'icon';
        return div;
      },
      codicon: (iconClass) => {
        const codIcon = document.createElement('i');
        codIcon.classList = `codicon ${iconClass}`;
        codIcon.addEventListener('click', handlers.codIconClicked);
        return codIcon;
      },
      histPath: (path) => {
        const div = document.createElement('div');
        // https://www.tutorialspoint.com/how-to-check-if-a-string-is-html-or-not-using-javascript
        if (/<([A-Za-z][A-Za-z0-9]*)((\b[^>]*>((.|(\r?\n))*?)<\/\1>)|(\/\>))/.test(path)) {
          div.innerText = path.replace(/\n|\r/g, '');
        } else {
          div.innerHTML = path;
        }
        div.dataset.path = path;
        div.className = 'histPath';
        div.addEventListener('click', handlers.histPathClicked);
        return div;
      }
    },
    append: {
      pathListItem: (path) => {
        const li = doms.create.pathListItem();
        const histPathDiv = doms.create.histPath(path);
        const iconDiv = doms.create.icon();
        const closeCodIcon = doms.create.codicon('codicon-close');

        iconDiv.appendChild(closeCodIcon);
        li.appendChild(histPathDiv);
        li.appendChild(iconDiv);

        pathListDom.insertBefore(li, pathListDom.firstChild);
      }
    }
  }

  const handlers = {
    /**
     * handler when runPath button is clicked
     */
    runPathClicked: () => {
      const path = pathDom.value;
      const historyPaths = vscode.getState().historyPaths || [];
      
      vscode.setState({
        ...vscode.getState(), 
        path, 
        historyPaths: processHistoryPaths(path, historyPaths)
      });
  
      vscode.postMessage({
        type: 'run',
        path: path.replace(/\n|\r/g, '')
      });
    },
    /**
     * handler when the histPath div is clicked
     */
    histPathClicked: (event) => {
      if (event.currentTarget.dataset.path.trim().length) {
        pathDom.value = event.currentTarget.dataset.path;
        vscode.setState({...vscode.getState(), path: pathDom.value});
      }
    },
    /**
     * handler when the codicon i element is clicked
     */
    codIconClicked: (event) => {
      const historyPaths = vscode.getState().historyPaths || [];
      const iconDiv = event.currentTarget.parentElement;
      const li = iconDiv.parentElement;
      const histPathDiv = li.querySelector('.histPath');
  
      // remove from state
      vscode.setState({
        ...vscode.getState(),
        historyPaths: historyPaths.filter(path => path !== histPathDiv.innerHTML)
      });
  
      // remove from html dom
      li.parentElement.removeChild(li);
    }
  }
 
  document.querySelector('.run').addEventListener('click', handlers.runPathClicked);
  document.querySelectorAll('.histPath').forEach(histPath => histPath.addEventListener('click', handlers.histPathClicked));
  document.querySelectorAll('.codicon-close').forEach(removeIcon => removeIcon.addEventListener('click', handlers.codIconClicked))
  
  window.addEventListener('message', event => {
    const message = event.data;
    switch(message.type) {
      case 'error':
        errorDiv = document.querySelector('#errorMessage');
        errorDiv.innerHTML = message.message;
        break;
      case 'reset': 
        errorDiv = document.querySelector('#errorMessage');
        errorDiv.innerHTML = '';
        break;
    }
  });

  // dynamically load the pathListItems
  (oldState.historyPaths || []).forEach(path => {
    doms.append.pathListItem(path);
  });
}());
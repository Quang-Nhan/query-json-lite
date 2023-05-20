
(function () {
 
  const vscode = acquireVsCodeApi();
  const oldState = vscode.getState();
  const pathDom = document.querySelector('.path');
  pathDom.value = oldState?.path.length ? oldState?.path : '';
 
  document.querySelector('.run').addEventListener('click', () => {
    console.log('yes')
    const path = pathDom.value;
    vscode.setState({path})
    vscode.postMessage({
      type: 'run',
      path
    });
  });

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
}());


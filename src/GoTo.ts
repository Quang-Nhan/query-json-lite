import { KEYS, tNode } from 'jsxpath';
import * as vscode from 'vscode';

export type tNodes = {
  current?: tNode,
  ancestors?: tNode
}

const search = (symbols: vscode.DocumentSymbol[], nodes:tNodes) => {
  let docSymbols = [...symbols];
  const ancestors = [...(nodes.ancestors || [])]
  do {
    const an = ancestors.pop();
    if (!['{$r}', '{$o}'].includes(an[KEYS.name])) {
      const matchedSymbol = docSymbols.find(s => {
        return s.name === an[KEYS.name] ||
          (
            !isNaN(an[KEYS.arrayPosition]) && 
            String(an[KEYS.arrayPosition]) === s.name && 
            s.children.length
          ) ||
          false
      });
      
      if (matchedSymbol) {
        docSymbols = matchedSymbol.children;
      }
    }
  } while(ancestors.length);

  if (docSymbols.length && nodes.current) {
    return docSymbols.find(s => {
      return !isNaN(nodes.current?.[KEYS.arrayPosition]) && !isNaN(Number(s.name))
        ? nodes.current?.[KEYS.arrayPosition] === Number(s.name)
        : s.name === nodes.current?.[KEYS.name];
    });
  }
}

const goToSymbol = async (nodes: tNodes, document?: vscode.TextDocument) => {
  if (document) {
    let viewColumn;
    vscode.window.tabGroups.all.find(tabGroup => {
      if (tabGroup.tabs.some(t => t.input && (t.input as vscode.TextDocument).uri?.fsPath === document.uri?.fsPath)) {
        viewColumn = tabGroup.viewColumn;
        return true;
      }
      return false;
    });

    if (!viewColumn) {
      viewColumn = vscode.window.tabGroups.activeTabGroup.viewColumn
    }
    
    vscode.window.showTextDocument(document, viewColumn, false).then(async (textEditor) => {
      const symbols = await getSymbols(document);
      const findSymbol = search(symbols, nodes);
      if (findSymbol && textEditor) {
        textEditor.revealRange(findSymbol.range, vscode.TextEditorRevealType.InCenter);
        const startPosition = new vscode.Position(findSymbol.range.start.line, findSymbol.range.start.character);
        const endPosition = new vscode.Position(findSymbol.range.end.line, findSymbol.range.end.character);
        const selection = new vscode.Selection(startPosition, endPosition);
        
        textEditor.selection = selection
      }
    });
  }
}

const getSymbols = async (document?: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> => {
  return document && await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri) || [];
}

export const goto = (nodes: tNodes, document?: vscode.TextDocument) => {
  if (nodes.current) {
    goToSymbol(nodes, document);
  }
}

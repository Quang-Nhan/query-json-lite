import * as vscode from 'vscode';
import { QueryJSONState, tDocumentMeta, tHighlightOptions, tRange, tSubscriberArgs } from './QueryJSONState';
import { KEYS, tNode } from 'jsxpath';

export type tNodes = {
  current?: tNode,
  ancestors?: tNode
};

type tDocCache = {
  document: vscode.TextDocument | undefined,
  symbols: vscode.DocumentSymbol[] | undefined
}

export class QueryJSONDocumentUtility {
  docCache: tDocCache = {
    document: undefined,
    symbols: undefined
  }
  
  constructor(){}

  public async cacheDocument(document: vscode.TextDocument) {
    const symbols = await this.getSymbols(document)
    this.docCache = {
      document,
      symbols
    };
  }
  
  public getSymbolRanges(nodes: tNodes) {
    if (!this.docCache.symbols) return;

    const foundSymbol = this.searchForSymbol(this.docCache.symbols, nodes);

    if (!foundSymbol) return;

    return {
      startLine: foundSymbol.range.start.line,
      startCharacter: foundSymbol.range.start.character,
      endLine: foundSymbol.range.end.line,
      endCharacter: foundSymbol.range.end.character
    };
  }

  public async goToSymbol(nodes: tNodes, document?: vscode.TextDocument) {
    if (document) {
      this.getDocumentTextEditors(document.uri.fsPath, undefined, true)
        .then(async (textEditors) => {
          const symbols = await this.getSymbols(document);
          const findSymbol = this.search(symbols, nodes);
          if (findSymbol) {
            const startPosition = new vscode.Position(findSymbol.range.start.line, findSymbol.range.start.character);
            const endPosition = new vscode.Position(findSymbol.range.end.line, findSymbol.range.end.character);
            const selection = new vscode.Selection(startPosition, endPosition);

            textEditors.forEach((textEditor) => {              
              textEditor.revealRange(findSymbol.range, vscode.TextEditorRevealType.InCenter);
              textEditor.selection = selection
            });
          }
        });
    }
  }

  public getActiveViewColumns(fsPath: string) {
    let viewColumns: number[] = [];
    vscode.window.tabGroups.all.find(tabGroup => {
      const tab = tabGroup.tabs.find(t => t.input && (t.input as vscode.TextDocument).uri?.fsPath === fsPath)
      if (tab && tab.isActive) {
          viewColumns.push(tabGroup.viewColumn);
      }
    });
    // make sure that the last view column is the current activate tab
    if (
      viewColumns.includes(vscode.window.tabGroups.activeTabGroup.viewColumn) &&
      viewColumns.at(viewColumns.length-1) !== vscode.window.tabGroups.activeTabGroup.viewColumn
    ) {
      viewColumns = viewColumns.filter(vc => vc !== vscode.window.tabGroups.activeTabGroup.viewColumn);
      viewColumns.push(vscode.window.tabGroups.activeTabGroup.viewColumn);
    }
    return viewColumns;
  }

  public getDocumentTextEditors(fsPath: string, viewColumn?: number, activeTab?: boolean) {
    let viewColumns: number[] = [];
    if (viewColumn) {
      viewColumns = [viewColumn];
    } else {
      viewColumns = activeTab ? [] : this.getActiveViewColumns(fsPath)

      if (!viewColumns.length) {
        viewColumns = [vscode.window.tabGroups.activeTabGroup.viewColumn]
      }
    }
    return vscode.workspace.openTextDocument(fsPath)
      .then((document) => {
        return Promise.all(viewColumns.map(vc => vscode.window.showTextDocument(document, vc, false))) 
      });
  }

  private searchForSymbol(symbols: vscode.DocumentSymbol[], nodes: tNodes) {
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

  private async getSymbols(document?: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    return document && await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri) || [];
  } 

  private search(symbols: vscode.DocumentSymbol[], nodes:tNodes) {
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
}

export class QueryJSONDocumentProcessor {
  private disposibleListener: vscode.Disposable;
  private highLightDecor: vscode.TextEditorDecorationType;
  private qjDocUtility;
  private decorOptions: vscode.DecorationRenderOptions = {};


  constructor(private qjState: QueryJSONState) {
    this.highLightDecor = this.getHighlightDecor({hex: '', hexOpacity: '1', highlightEnabled: true});
    this.qjDocUtility = new QueryJSONDocumentUtility();
    this.disposibleListener = vscode.window.tabGroups.onDidChangeTabs((e) => {
      const changedOpenedFile = (e.changed.at(0)?.input || e.opened.at(0)?.input) as vscode.TextDocument;
      const closedFile = e.closed.at(0)?.input;
      if (!changedOpenedFile && !closedFile) return;
      
      const documents = this.qjState.getDocumentMetas();
      if (!documents.length) return;
      
      const filePath = changedOpenedFile.uri.query.length ? JSON.parse(changedOpenedFile.uri.query).path : changedOpenedFile.uri.fsPath;
      const docMeta = documents.find((d) => d.fsPath === filePath);
      
      if (closedFile && docMeta) {
        this.clearHighlight(docMeta);
        this.qjDocUtility.getDocumentTextEditors(docMeta.fsPath, e.closed.at(0)?.group.viewColumn)
          .then(editors => {
            editors.forEach(editor => {
              editor.setDecorations( this.highLightDecor, [] );
            });
          });
      }
      
      if (docMeta) {
        this.qjDocUtility.getDocumentTextEditors(docMeta.fsPath, e.changed.at(0)?.group.viewColumn || e.opened.at(0)?.group.viewColumn)
          .then(editors => {
            editors.forEach(editor => {
              editor.setDecorations( this.highLightDecor, getRanges(docMeta.ranges) );
            });
          });
      }
    });
    
    this.qjState.subscribe(({type, state}: tSubscriberArgs) => {
      if (type === 'before-reset') {
        this.highLightDecor.dispose();
      } else if (state.currentDocumentMeta) {
        this.qjDocUtility.getDocumentTextEditors(state.currentDocumentMeta.fsPath)
          .then(editors => {
            if (type === 'hex-changed') {
              this.highLightDecor.dispose();
            }
            switch(type) {
              case 'on-subscribe': {
                editors.forEach(editor => {
                  editor.setDecorations( this.highLightDecor, getRanges(state.currentDocumentMeta?.ranges as tDocumentMeta['ranges']) )
                });
                break;
              };
              case 'range-changed':
              case 'hex-changed': {
                const highLightDecor = this.getHighlightDecor({hex: state.hex || '', hexOpacity: state.hexOpacity || '1', highlightEnabled: !!state.highlightEnabled});
                editors.forEach(editor => {
                  editor.setDecorations( highLightDecor, state.highlightEnabled ? getRanges(state.currentDocumentMeta?.ranges as tDocumentMeta['ranges']) : [] );
                });
                break;
              };
          }});
      }
    });
  }

  public clearHighlight(docMeta?: tDocumentMeta, viewColumn?: number) {
    return new Promise(() => {
      if (docMeta) {
        const viewColumns = viewColumn ? [viewColumn] : this.qjDocUtility.getActiveViewColumns(docMeta.fsPath);
        vscode.workspace.openTextDocument(docMeta.fsPath)
          .then((document) => {
            return Promise.all(viewColumns.map(vc => vscode.window.showTextDocument(document, vc, false)))
              .then(editors => {
                editors.forEach(editor => editor.setDecorations(this.highLightDecor, []));
              })
          });
      }
    });
  }

  public goto(nodes: tNodes, document?: vscode.TextDocument) {
    if (nodes.current) {
      this.qjDocUtility.goToSymbol(nodes, document);
    }
  }

  private getHighlightDecor(hexValues: tHighlightOptions): vscode.TextEditorDecorationType {
    this.highLightDecor = vscode.window.createTextEditorDecorationType(this.getHighlightOptions(hexValues));
    return this.highLightDecor;
  }

  private getHighlightOptions(hexValues: tHighlightOptions): vscode.DecorationRenderOptions  {
    const rgba = convertHexToRGBA(hexValues);
    this.decorOptions = {
      backgroundColor: rgba
    }
    return this.decorOptions;
  }
}

const convertHexToRGBA = ({hex, hexOpacity}: tHighlightOptions) => {
  const cleanedHex = hex.replace('#', '');
  const r = parseInt(cleanedHex.substring(0, 2), 16);
  const g = parseInt(cleanedHex.substring(2, 4), 16);
  const b = parseInt(cleanedHex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${hexOpacity})`;
}

const getRanges = (ranges: tDocumentMeta['ranges']) => {
  return ranges.map((meta) => {
    return new vscode.Range(
      new vscode.Position(meta.startLine, meta.startCharacter),
      new vscode.Position(meta.endLine, meta.endCharacter)
    );
  }) || [];
}
import { KEYS, tNode, tNodesState } from 'jsxpath';
import * as vscode from 'vscode';

export class NodeItem extends vscode.TreeItem {
	constructor(
	  public readonly label: string,
	  private value: string,
    public id: string,
    private actualValue?: any,
    private arrayPosition?: number
	) {
    const collapsibleState = ['{$o}', '{$a}'].includes(value) 
      ? vscode.TreeItemCollapsibleState.Collapsed 
      : vscode.TreeItemCollapsibleState.None;
	  super(label, collapsibleState);
	  this.description = String(this.getDisplayValue(this.label, this.value, this.actualValue));
	  this.tooltip = `${this.label}: ${this.description}`;
	}

  private getDisplayValue(label:string, value: string, actualValue?: any) {
    if (actualValue) {
      return JSON.stringify(actualValue);
    };
    if (label === '{$ao}') {
      return '';
    }
    if (value === '{$o}' ) {
      return '{...}';
    }
    if (value === '{$a}') {
      return '[...]'
    }
    return value;
  }
}
  
export class QueryJSONTreeDataProvider implements vscode.TreeDataProvider<NodeItem> {
  public static readonly viewType = 'query-json-lite.result';
  nodesValue: tNode[] = [];
  nodes: tNodesState['nodes']['byId'] = {};
  value: any;
  constructor() {}

  public update(pathResult: {nodesValue: tNode[], nodes: tNodesState['nodes']['byId'], value: any }) {
    this.nodes = pathResult.nodes;
    this.nodesValue = pathResult.nodesValue;
    this.value = pathResult.value;
  }

  public getTreeItem(element: NodeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  public getChildren(element?: NodeItem | undefined): vscode.ProviderResult<NodeItem[]> {
    if (!this.nodesValue) {
      // vscode.window.showInformationMessage('No result found');
      return;
    }
    if (element) {
      const currentNode = this.nodes[Number(element.id)];
      return Promise.resolve(currentNode[KEYS.links].childrenIds.map((id: number) => {
        const child = this.nodes[id];
        let label = this.getDisplaylabel(child[KEYS.name]);
        if (currentNode[KEYS.valueType] === 'array') {
          label = String(child[KEYS.arrayPosition]);
        }
        return new NodeItem(label, child[KEYS.value], child[KEYS.id]);
      }));
    } else if (this.nodesValue.length) {
      return Promise.resolve(this.nodesValue.map((node, i) => {
        return new NodeItem(this.getDisplaylabel(node[KEYS.name]), node[KEYS.value], node[KEYS.id], this.value[i]);
      }));
    } else {
      return Promise.resolve(
        [new NodeItem('result', typeof this.value === 'string' ? this.value : String(this.value), '-1')]
      );
    }
  }

  
  private _onDidChangeTreeData: vscode.EventEmitter<NodeItem | undefined | null | void> = new vscode.EventEmitter<NodeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<NodeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private getDisplaylabel(label: string) {
    if (['{$o}', '{$ao}'].includes(label)) {
      return '{ }';
    }
    if (label === '{$a}') {
      return '[ ]';
    }
    return label;
  }
}
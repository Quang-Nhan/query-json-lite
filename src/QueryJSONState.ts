import * as vscode from 'vscode';

export type tRange = {
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
}

export type tDocumentMeta = {
  fsPath: string,
  ranges: tRange[]
}

export type tQJState = {
  version: number,
  mode: string,
  currentDocumentMeta?: tDocumentMeta,
  hex?: string,
  hexOpacity?: string,
  highlightEnabled?: boolean
};

export type tSubscriberArgs = {
  type: string, state: tQJState
}

export type tHighlightOptions = {
  hex: string,
  hexOpacity: string,
  highlightEnabled: boolean
};

export class QueryJSONState {
  private state: tQJState;
  private QJSTATE = 'QJSTATE';
  private VERSION = 1;
  private subscribers: Function[] = [];
  
  constructor(private context: vscode.ExtensionContext) {
    const savedState = context.workspaceState.get(this.QJSTATE, JSON.stringify(this.getDefaultState()));
    this.state = savedState && savedState.length ? JSON.parse(savedState) : this.getDefaultState();

    // version 1 always reset currentDocumentMeta
    if (this.state.version === 1) {
      this.state = this.getDefaultState();
    }
    
    // future implementations
    if (this.state.version !== this.VERSION) {
      this.state = this.getDefaultState();
    }

    // TODO: future move all webview states here
  }

  public reset() {
    this.emit('before-reset');
    this.state = this.getDefaultState();
    this.save();
  }

  public switchMode(mode: 'query' | 'find') {
    this.state.mode = mode;
  }

  public addDocumentRange(uri: string, range: tRange, done?: boolean) {
    if (!this.state.currentDocumentMeta || this.state.currentDocumentMeta.fsPath !== uri) {
      this.state.currentDocumentMeta = {
        fsPath: uri,
        ranges: []
      }
    }
    this.state.currentDocumentMeta?.ranges.push(range);
    this.save();
    if (done) {
      this.emit('range-changed');
    }
  }

  public save() {
    this.context.workspaceState.update(this.QJSTATE, JSON.stringify(this.state))
  }

  public setHexValues({hex, hexOpacity}: tHighlightOptions) {
    this.state.hex = hex;
    this.state.hexOpacity = hexOpacity;
    this.save();
    this.emit('hex-changed');
  }

  public enableHighlight(enable: boolean) {
    this.state.highlightEnabled = !!enable;
    this.save();
    this.emit('hex-changed');
  }

  public getDocumentHighlightOptions(): tHighlightOptions {
    return {
      hex: this.state.hex || '',
      hexOpacity: this.state.hexOpacity || '',
      highlightEnabled: this.state.highlightEnabled === undefined ? true : this.state.highlightEnabled
    }
  }

  public getDocumentMetas() {
    return this.state.currentDocumentMeta ? [this.state.currentDocumentMeta] : [];
  }

  public subscribe(subscriber: Function) {
    this.subscribers.push(subscriber);
    subscriber({
      type: 'on-subscribe',
      state: this.state
    });
    return this.disposable(subscriber);
  }

  private disposable(subscriber: Function) {
    return () => ({
      dispose: () => {
        this.subscribers = this.subscribers.filter(sub =>  sub !== subscriber);
      }
    });
  }

  private emit(type: string) {
    this.subscribers.forEach((subscriber) => {
      subscriber({
        type,
        state: this.state
      });
    });
  }

  private getDefaultState(): tQJState {
    return {
      version: this.VERSION,
      mode: 'query',
      currentDocumentMeta: undefined,
      hex: this.state?.hex,
      hexOpacity: this.state?.hexOpacity,
      highlightEnabled: typeof this.state?.highlightEnabled === 'boolean' ? this.state.highlightEnabled : true
    }
  }
}
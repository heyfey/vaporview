// Description: This file contains the extension logic for the VaporView extension
// This code was generated by ChatGPT 3.5 with a sequence of guided prompts

import * as vscode from 'vscode';
import * as path from 'path';
import { on } from 'process';

//import { getNonce } from 'util';

/**
 * Define the type of edits used in paw draw files.
 */
interface VaporviewDocumentDelegate {
  getViewerContext(): Promise<Uint8Array>;
}

/**
 * Define the document (the data model) used for paw draw files.
 */
class VaporviewDocument extends vscode.Disposable implements vscode.CustomDocument {

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    delegate: VaporviewDocumentDelegate,
  ): Promise<VaporviewDocument | PromiseLike<VaporviewDocument>> {
    console.log("create()");
    // If we have a backup, read that. Otherwise read the resource from the workspace

    // Read the VCD file using vscode.workspace.openTextDocument
    const vcdDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(uri.fsPath));
    const vcdContent  = vcdDocument.getText();

    const netlistTreeDataProvider          = new NetlistTreeDataProvider();
    const displayedSignalsTreeDataProvider = new DisplayedSignalsViewProvider();
    const waveformDataSet                  = new WaveformTop();

    // Parse the VCD data for this specific file
    parseVCDData(vcdContent, netlistTreeDataProvider, waveformDataSet);
    console.log(waveformDataSet.netlistElements);
    // Optionally, you can refresh the Netlist view
    netlistTreeDataProvider.refresh();

    return new VaporviewDocument(
      uri,
      waveformDataSet,
      netlistTreeDataProvider,
      displayedSignalsTreeDataProvider,
      delegate
    );
  }

  private readonly _uri: vscode.Uri;
  private _documentData: WaveformTop;
  private _netlistTreeDataProvider: NetlistTreeDataProvider;
  private _displayedSignalsTreeDataProvider: DisplayedSignalsViewProvider;
  private readonly _delegate: VaporviewDocumentDelegate;

  private constructor(
    uri: vscode.Uri,
    waveformData: WaveformTop,
    _netlistTreeDataProvider: NetlistTreeDataProvider,
    _displayedSignalsTreeDataProvider: DisplayedSignalsViewProvider,
    delegate: VaporviewDocumentDelegate
  ) {
    super(() => this.dispose());
    this._uri = uri;
    this._documentData = waveformData;
    this._netlistTreeDataProvider = _netlistTreeDataProvider;
    this._displayedSignalsTreeDataProvider = _displayedSignalsTreeDataProvider;
    this._delegate = delegate;
  }

  public get uri() { return this._uri; }
  public get documentData(): WaveformTop { return this._documentData; }
  public get netlistTreeData(): NetlistTreeDataProvider { return this._netlistTreeDataProvider; }
  public get displayedSignalsTreeData(): DisplayedSignalsViewProvider { return this._displayedSignalsTreeDataProvider; }

  //private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  /**
   * Fired when the document is disposed of.
   */
  //public readonly onDidDispose = this._onDidDispose.event;

  /**
   * Called by VS Code when there are no more references to the document.
   *
   * This happens when all editors for it have been closed.
   */
  dispose(): void {
    //this._onDidDispose.fire();
    this._documentData.dispose();
  }
}

class WaveformViewerProvider implements vscode.CustomReadonlyEditorProvider<VaporviewDocument> {

  private static newViewerId = 1;
  private static readonly viewType = 'vaporview.waveformViewer';
  private readonly webviews = new WebviewCollection();

  public netlistTreeDataProvider: NetlistTreeDataProvider;
  public netlistView: vscode.TreeView<NetlistItem>;
  public displayedSignalsTreeDataProvider: DisplayedSignalsViewProvider;
  public displayedSignalsView: vscode.TreeView<NetlistItem>;
  public cursorTimeStatusBarItem: vscode.StatusBarItem;
  public selectedSignalStatusBarItem: vscode.StatusBarItem;

  constructor(private readonly _context: vscode.ExtensionContext) {

    // Create and register the Netlist and Displayed Signals view container
    this.netlistTreeDataProvider = new NetlistTreeDataProvider();
    this.netlistView = vscode.window.createTreeView('netlistContainer', {
      treeDataProvider: this.netlistTreeDataProvider,
    });
    this._context.subscriptions.push(this.netlistView);

    this.displayedSignalsTreeDataProvider = new DisplayedSignalsViewProvider();
    this.displayedSignalsView = vscode.window.createTreeView('displaylistContainer', {
      treeDataProvider: this.displayedSignalsTreeDataProvider,
    });
    this._context.subscriptions.push(this.displayedSignalsView);

    // Create a status bar item for cursor time and
    this.cursorTimeStatusBarItem     = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.selectedSignalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }

  //#region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<VaporviewDocument> {
    console.log("openCustomDocument()");
    const document: VaporviewDocument = await VaporviewDocument.create(uri, openContext.backupId, {
      getViewerContext: async () => {
        const webviewsForDocument = Array.from(this.webviews.get(document.uri));
        if (!webviewsForDocument.length) {
          throw new Error('Could not find webview to save for');
        }
        const panel    = webviewsForDocument[0];
        const response = await this.postMessageWithResponse<number[]>(panel, 'getContext', {});
        return new Uint8Array(response);
      }
    });

    this.netlistTreeDataProvider.setTreeData(document.netlistTreeData.getTreeData());
    this.displayedSignalsTreeDataProvider.setTreeData(document.displayedSignalsTreeData.getTreeData());

    return document;
  }

  async resolveCustomEditor(
    document: VaporviewDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    console.log("resolveCustomEditor()");
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getWebViewContent(webviewPanel.webview);

    webviewPanel.onDidDispose(() => {
      if (this.webviews.getNumWebviews === 0) {
        this.netlistTreeDataProvider.setTreeData([]);
        this.displayedSignalsTreeDataProvider.setTreeData([]);
      }
    });

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage(e => {
      console.log(e);
      console.log(document.uri);
      if (e.type === 'ready') {
        if (document.uri.scheme === 'untitled') {
          console.log("untitled scheme");
        }
        webviewPanel.webview.postMessage({
          command: 'create-ruler',
          waveformDataSet: document.documentData,
        });
      }
      switch (e.command) {
        case 'init': {
          // Webview is initialized, send the 'init' message
        }
        case 'deleteSignal': {
          // Receive a request to render a signal
          const signalId = e.signalId;
          //netlistTreeDataProvider.toggleCheckboxState();
          break;
        }
        case 'setTime': {
          if (e.time !== null) {
            this.cursorTimeStatusBarItem.text = 'time: ' + e.time + ' ' + document.documentData.timeUnit;
            this.cursorTimeStatusBarItem.show();
          } else {
            this.cursorTimeStatusBarItem.hide();
          }
          break;
        }
        case 'setSelectedSignal': {
          if (e.signalId !== null) {
            this.selectedSignalStatusBarItem.show();
            const signalName = document.documentData.netlistElements.get(e.signalId)?.name;
            this.selectedSignalStatusBarItem.text = 'Selected signal: ' + signalName;
          } else {
            this.selectedSignalStatusBarItem.hide();
          }
          break;
        }
        case 'close-webview' : {
          // Close the webview
          webviewPanel.dispose();
          break;
        }
      }
      this.onMessage(document, e);
    });

    webviewPanel.onDidChangeViewState(e => {
      console.log("onDidChangeViewState()");
      console.log(e);
      if (e.webviewPanel.active) {
        this.netlistTreeDataProvider.setTreeData(document.netlistTreeData.getTreeData());
        this.displayedSignalsTreeDataProvider.setTreeData(document.displayedSignalsTreeData.getTreeData());
        webviewPanel.webview.postMessage({command: 'getSelectionContext'});
        this.cursorTimeStatusBarItem.show();
        this.selectedSignalStatusBarItem.show();
      } else {
        this.cursorTimeStatusBarItem.hide();
        this.selectedSignalStatusBarItem.hide();
      }
    });

    // Subscribe to the checkbox state change event
    this.netlistView.onDidChangeCheckboxState((changedItem) => {
      if (!webviewPanel.active) {return;}
      const metadata   = changedItem.items[0][0];
      const signalId   = metadata.signalId;
      const signalData = document.documentData.netlistElements.get(signalId);

      if (metadata.checkboxState === vscode.TreeItemCheckboxState.Checked) {
        this.renderSignal(webviewPanel, signalId, signalData);
        this.displayedSignalsTreeDataProvider.addSignalToTreeData(metadata);
      } else if (metadata.checkboxState === vscode.TreeItemCheckboxState.Unchecked) {
        this.removeSignal(webviewPanel, signalId);
        this.displayedSignalsTreeDataProvider.removeSignalFromTreeData(metadata);
      }
    });

    this.displayedSignalsView.onDidChangeCheckboxState((changedItem) => {
      if (!webviewPanel.active) {return;}
      const metadata   = changedItem.items[0][0];
      const signalId   = metadata.signalId;

      if (metadata.checkboxState === vscode.TreeItemCheckboxState.Unchecked) {
        this.netlistTreeDataProvider.setCheckboxState(metadata, vscode.TreeItemCheckboxState.Unchecked);
        this.displayedSignalsTreeDataProvider.removeSignalFromTreeData(metadata);
        this.removeSignal(webviewPanel, signalId);
      }
    });

  }

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private onMessage(document: VaporviewDocument, message: any) {
    switch (message.type) {
      case 'response':
        {
          const callback = this._callbacks.get(message.requestId);
          callback?.(message.body);
          return;
        }
    }
  }

  private renderSignal(panel: vscode.WebviewPanel, signalId: string, signalData: SignalWaveform | undefined) {
    // Render the signal with the provided ID
    panel.webview.postMessage({ 
      command: 'render-signal',
      waveformData: signalData,
      signalId: signalId
   });
  }

  private removeSignal(panel: vscode.WebviewPanel, signalId: string) {
    // Render the signal with the provided ID
    panel.webview.postMessage({ 
      command: 'remove-signal',
      signalId: signalId
   });
  }

    // To do: implement nonce with this HTML:
  //<script nonce="${nonce}" src="${scriptUri}"></script>

  private getWebViewContent(webview: vscode.Webview): string {

    const extensionUri = this._context.extensionUri;

    const webAssets = {
      diamondUri:   webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'diamond.svg')),
      svgIconsUri:  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'icons.svg')),
      jsFileUri:    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vaporview.js')),
      cssFileUri:   webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css')),
      testImageUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'wave_temp.png')),
      clusterize:   webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'clusterize_mod.js')),
      codiconsUri:  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')),
    };

    // Generate the HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>VaporView - Waveform Viewer</title>
        <link rel="stylesheet" href="${webAssets.codiconsUri}"/>
        <link rel="stylesheet" href="${webAssets.cssFileUri}">
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${webAssets.diamondUri}" rel="diamond.svg" type="image/svg+xml">
        <link href="${webAssets.svgIconsUri}" rel="icons.svg" type="image/svg+xml">
      </head>
      <body>
        <div id="vaporview-top">
          <div id="control-bar">
            <svg xmlns="http://www.w3.org/2000/svg" style="display:none">
              <defs>
                <symbol id="binary-edge" viewBox="0 0 16 16">
                  <path d="M 2 15 L 6 15 C 8 15 8 15 8 13 L 8 3 C 8 1 8 1 10 1 L 14 1"/>
                </symbol>
                <symbol id="binary-edge-alt" viewBox="0 0 16 16">
                  <path d="M 2 14 L 2 14 L 8 14 L 8 3 C 8 1 8 1 10 1 L 14 1 L 14 2 L 9 2 L 9 13 C 9 15 9 15 7 15 L 2 15 L 2 14"/>
                </symbol>
                <symbol id="bus-edge" viewBox="0 0 16 16">
                  <polyline points="2,15 5,15 11,1 14,1"/>
                  <polyline points="2,1 5,1 11,15 14,15"/>
                </symbol>
                <symbol id="arrow" viewBox="0 0 16 16">
                  <polyline points="1,8 8,8"/>
                  <polyline points="5,5 8,8 5,11"/>
                </symbol>
                <symbol id="back-arrow" viewBox="0 0 16 16">
                  <use href="#arrow" transform="scale(-1, 1) translate(-16, 0)"/>
                </symbol>
                <symbol id="next-posedge" viewBox="0 0 16 16">
                  <use href="#arrow"/>
                  <use href="#binary-edge" transform="translate(3, 0)"/>
                </symbol>
                <symbol id="next-negedge" viewBox="0 0 16 16">
                  <use href="#arrow"/>
                  <use href="#binary-edge" transform="translate(3, 16) scale(1, -1)"/>
                </symbol>
                <symbol id="next-edge" viewBox="0 0 16 16">
                  <use href="#arrow"/>
                  <use href="#bus-edge" transform="translate(3, 0)"/>
                </symbol>
                <symbol id="previous-posedge" viewBox="0 0 16 16">
                  <use href="#back-arrow"/>
                  <use href="#binary-edge" transform="translate(-3, 0)"/>
                </symbol>
                <symbol id="previous-negedge" viewBox="0 0 16 16">
                  <use href="#back-arrow"/>
                  <use href="#binary-edge" transform="translate(-3, 16) scale(1, -1)"/>
                </symbol>
                <symbol id="previous-edge" viewBox="0 0 16 16">
                  <use href="#back-arrow"/>
                  <use href="#bus-edge" transform="translate(-3, 0)"/>
                </symbol>
                <symbol id="time-equals" viewBox="0 0 16 16">
                  <text x="8" y="8" class="icon-text">t=</text>
                </symbol>
                <symbol id="search-hex" viewBox="0 0 16 16">
                  <text x="8" y="8" class="icon-text">hex</text>
                </symbol>
                <symbol id="search-binary" viewBox="0 0 16 16">
                  <text x="8" y="8" class="icon-text">bin</text>
                </symbol>
                <symbol id="search-decimal" viewBox="0 0 16 16">
                  <text x="8" y="8" class="icon-text">dec</text>
                </symbol>
                <symbol id="search-enum" viewBox="0 0 16 16">
                  <text x="8" y="8" class="icon-text">Abc</text>
                </symbol>
                <symbol id="touchpad" viewBox="0 0 16 16">
                  <path d="M 1 2 L 1 10 C 1 11 2 11 2 11 L 3 11 L 3 10 L 2 10 L 2 2 L 14 2 L 14 10 L 12 10 L 12 11 L 14 11 C 14 11 15 11 15 10 L 15 2 C 15 2 15 1 14 1 L 2 1 C 1 1 1 2 1 2 M 4 14 L 5 14 L 5 11 C 5 10 5 9 6 9 C 7 9 7 10 7 11 L 7 14 L 8 14 L 8 9 C 8 8 8 7 9 7 C 10 7 10 8 10 9 L 10 14 L 11 14 L 11 9 C 11 7 10.5 6 9 6 C 7.5 6 7 7 7 8 L 7 8.5 C 6.917 8.261 6.671 8.006 6 8 C 4.5 8 4 9 4 11 L 4 14"/>
                </symbol>
              </defs>
            </svg>
            <div class="control-bar-group">
              <div class="control-bar-button" title="Zoom Out (Ctrl + scroll down)" id="zoom-out-button">
                <div class='codicon codicon-zoom-out' style="font-size:20px"></div>
              </div>
              <div class="control-bar-button" title="Zoom In (Ctrl + scroll up)" id="zoom-in-button">
                <div class='codicon codicon-zoom-in' style="font-size:20px"></div>
              </div>
            </div>
            <div class="control-bar-group">
              <div class="control-bar-button" title="Go To Previous Negative Edge Transition" id="previous-negedge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#previous-negedge"/></svg>
              </div>
              <div class="control-bar-button" title="Go To Previous Positive Edge Transition" id="previous-posedge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#previous-posedge"/></svg>
              </div>
              <div class="control-bar-button" title="Go To Previous Transition (Ctrl + &#8678;)" id="previous-edge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#previous-edge"/></svg>
              </div>
              <div class="control-bar-button" title="Go To Next Transition (Ctrl + &#8680;)" id="next-edge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#next-edge"/></svg>
              </div>
              <div class="control-bar-button" title="Go To Next Positive Edge Transition" id="next-posedge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#next-posedge"/></svg>
              </div>
              <div class="control-bar-button" title="Go To Next Negative Edge Transition" id="next-negedge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#next-negedge"/></svg>
              </div>
            </div>
            <div class="control-bar-group">
              <div id="search-container">
                <textarea id="search-bar" class="search-input" autocorrect="off" autocapitalize="off" spellcheck="false" wrap="off" aria-label="Find" placeholder="Search" title="Find"></textarea>
                <div class="search-button selected-button" title="Go to Time specified" id="time-equals-button">
                  <svg class="custom-icon" viewBox="0 0 16 16"><use href="#time-equals"/></svg>
                </div>
                <div class="search-button" title="Search by binary value" id="value-equals-button">
                  <svg class="custom-icon" viewBox="0 0 16 16"><use id="value-icon-reference" href="#search-binary"/></svg>
                </div>
              </div>
              <div class="control-bar-button" title="Previous" id="previous-button">
                <div class='codicon codicon-arrow-left' style="font-size:20px"></div>
              </div>
              <div class="control-bar-button" title="Next" id="next-button">
                <div class='codicon codicon-arrow-right' style="font-size:20px"></div>
              </div>
            </div>
            <div class="control-bar-group">
              <div class="format-button" title="Enable Touchpad Scrolling" id="touchpad-scroll-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#touchpad"/></svg>
              </div>
            </div>
          </div>
          <div id="viewer-container">
            <div id="resize-1" class="resize-bar"></div>
            <div id="resize-2" class="resize-bar"></div>
          </div>
          <div id="waveform-labels-container" class="labels-container">
            <div id="waveform-labels-spacer" class="ruler-spacer">
              <div class="format-button selected-button" title="Format in Binary" id="format-binary-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#search-binary"/></svg>
              </div>
              <div class="format-button" title="Format in Hexidecimal" id="format-hex-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#search-hex"/></svg>
              </div>
              <div class="format-button" title="Format in Decimal" id="format-decimal-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#search-decimal"/></svg>
              </div>
              <div class="format-button" title="Format as Enumerator (if available)" id="format-enum-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#search-enum"/></svg>
              </div>
            </div>
            <div id="waveform-labels"> </div>
          </div>
          <div id="transition-display-container" class="labels-container">
            <div class="ruler-spacer"></div>
            <div id="transition-display"></div>
          </div>
          <div id="scrollArea" class="clusterize-scroll">
            <div id="contentArea" class="clusterize-content">
              <div class="clusterize-no-data">Loading data…</div>
            </div>
          </div>
        </div>
        <script src="${webAssets.clusterize}"></script>
        <script src="${webAssets.jsFileUri}"></script>
      </body>
      </html>
    `;

    return htmlContent;
  }

}

/**
 * Tracks all webviews.
 */
class WebviewCollection {

  private numWebviews = 0;
  public get getNumWebviews() {return this.numWebviews;}

  private readonly _webviews = new Set<{
    readonly resource: string;
    readonly webviewPanel: vscode.WebviewPanel;
  }>();

  /**
   * Get all known webviews for a given uri.
   */
  public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.webviewPanel;
      }
    }
  }

  /**
   * Add a new webview to the collection.
   */
  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);
    this.numWebviews++;

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
      this.numWebviews--;
    });
  }
}

class NetlistTreeDataProvider implements vscode.TreeDataProvider<NetlistItem> {
  private treeData: NetlistItem[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<NetlistItem | undefined> = new vscode.EventEmitter<NetlistItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NetlistItem | undefined> = this._onDidChangeTreeData.event;

  public setCheckboxState(netlistItem: NetlistItem, checkboxState: vscode.TreeItemCheckboxState) {
    netlistItem.checkboxState = checkboxState;
    this._onDidChangeTreeData.fire(undefined); // Trigger a refresh of the Netlist view
  }

  // Method to set the tree data
  public setTreeData(netlistItems: NetlistItem[]) {
    this.treeData = netlistItems;
    this._onDidChangeTreeData.fire(undefined); // Trigger a refresh of the Netlist view
  }

  public getTreeData(): NetlistItem[] {return this.treeData;}

  getTreeItem(element:  NetlistItem): vscode.TreeItem {return element;}
  getChildren(element?: NetlistItem): Thenable<NetlistItem[]> {
    if (element) {return Promise.resolve(element.children);} // Return the children of the selected element
    else         {return Promise.resolve(this.treeData);} // Return the top-level netlist items
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

class DisplayedSignalsViewProvider implements vscode.TreeDataProvider<NetlistItem> {
  private treeData: NetlistItem[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<NetlistItem | undefined> = new vscode.EventEmitter<NetlistItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NetlistItem | undefined> = this._onDidChangeTreeData.event;

  // Method to set the tree data
  public setTreeData(netlistItems: NetlistItem[]) {
    this.treeData = netlistItems;
    this._onDidChangeTreeData.fire(undefined); // Trigger a refresh of the Netlist view
  }

  public getTreeData(): NetlistItem[] {return this.treeData;}

  getTreeItem(element:  NetlistItem): vscode.TreeItem {return element;}
  getChildren(element?: NetlistItem): Thenable<NetlistItem[]> {
    if (element) {return Promise.resolve(element.children);} // Return the children of the selected element
    else         {return Promise.resolve(this.treeData);} // Return the top-level netlist items
  }

  public addSignalToTreeData(netlistItem: NetlistItem) {
    this.treeData.push(netlistItem);
    this._onDidChangeTreeData.fire(undefined); // Trigger a refresh of the Netlist view
  }

  public removeSignalFromTreeData(netlistItem: NetlistItem) {
    const index = this.treeData.indexOf(netlistItem);
    if (index > -1) {
      this.treeData.splice(index, 1);
    }
    this._onDidChangeTreeData.fire(undefined); // Trigger a refresh of the Netlist view
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

interface TreeCheckboxChangeEvent<T> {
  item: T;
  checked: boolean;
}

class NetlistItem extends vscode.TreeItem {
  private _onDidChangeCheckboxState: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  onDidChangeCheckboxState: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeCheckboxState.event;

  constructor(
    public readonly label:            string,
    public readonly type:             string,
    public readonly width:            number,
    public readonly signalId:         string, // Signal-specific information
    public readonly name:             string,
    public readonly children:         NetlistItem[] = [],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public checkboxState: vscode.TreeItemCheckboxState = vscode.TreeItemCheckboxState.Unchecked // Display preference
  ) {
    super(label, collapsibleState);
    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.contextValue = 'netlistItem'; // Set a context value for leaf nodes
    }
  }

  // Method to toggle the checkbox state
  toggleCheckboxState() {
    this.checkboxState = this.checkboxState === vscode.TreeItemCheckboxState.Checked
      ? vscode.TreeItemCheckboxState.Unchecked
      : vscode.TreeItemCheckboxState.Checked;
    this._onDidChangeCheckboxState.fire(this);
  }
}

const BASE_CHUNK_TIME_WINDOW = 512;
const TIME_INDEX   = 0;
const VALUE_INDEX  = 1;

class WaveformTop {
  public netlistElements: Map<string, SignalWaveform>;
  public timeEnd:     number = 0;
  public filename:    string = "";
  public chunkTime:   number = BASE_CHUNK_TIME_WINDOW;
  public chunkCount:  number = 0;
  public timeScale:   number = 1;
  public defaultZoom: number = 1;
  public timeUnit:    string = "ns";

  constructor() {
    this.netlistElements = new Map();
    console.log(this);
  }

  public createSignalWaveform(name: string, signalId: string, width: number) {
    // Check if the signal waveform already exists, and if not, create a new one
    if (!this.netlistElements.has(signalId)) {
      let waveform = new SignalWaveform(name, width, this.chunkCount);
      this.netlistElements.set(signalId, waveform);
    }
  }

  public setInitialState(signalId: string, initialState: number | string = "x") {
    // Check if the signal waveform exists in the map
    const waveform = this.netlistElements.get(signalId);
    if (waveform) {
      // Add the transition data to the signal waveform
      waveform.transitionData.push([0, initialState]);
      waveform.chunkStart[0] = 1;
    } else {
      // Console log an error message if the signal waveform doesn't exist
      console.log("${signalID} not in netlist");
    }
  }

  public addTransitionData(signalId: string, transitionData: TransitionData, previousState: number | string) {
    // Check if the signal waveform exists in the map
    const waveform = this.netlistElements.get(signalId);
    if (waveform) {
      // Add the transition data to the signal waveform
      waveform.addTransitionData(transitionData, this.chunkTime);
    } else {
      // Console log an error message if the signal waveform doesn't exist
      console.log("${signalID} not in netlist");
    }
  }

  public dispose() {
    console.log("dispose()");
    this.netlistElements.clear();
    this.timeEnd = 0;
    this.filename = "";
    this.chunkCount = 0;
  }
}

class SignalWaveform {

  public transitionData: TransitionData[];
  public chunkStart: number[];

  constructor(
    public name: string,
    public signalWidth: number,
    chunkCount: number
    ) {
    this.chunkStart     = new Array(chunkCount);
    this.transitionData = [];
  }

  public addTransitionData(transitionValue: TransitionData, chunkTime: number) {
    const time       = transitionValue[TIME_INDEX];
    const chunkIndex = Math.floor(time / chunkTime);
    const previousChunkIndex = Math.floor(this.transitionData[this.transitionData.length - 1][TIME_INDEX] / chunkTime);
  
    for (let i = previousChunkIndex + 1; i <= chunkIndex; i++) {
      this.chunkStart[i] = this.transitionData.length;
    }

    this.transitionData.push(transitionValue);
  }
}

type TransitionData = [number, number | string];

// Function to parse the VCD data and populate the Netlist view
function parseVCDData(vcdData: string, netlistTreeDataProvider: NetlistTreeDataProvider, waveformDataSet: WaveformTop) {
  // Define a data structure to store the netlist items
  const netlistItems: NetlistItem[] = [];
  const stack:        NetlistItem[] = [];
  let currentScope:   NetlistItem | undefined;
  let currentSignal = "";

  // Define variables to track the current state
  let currentTimestamp  = 0;
  let initialState: number | string;
  const signalValues: Map<string, number | string> = new Map(); // Map to track signal values

  let currentMode: string | undefined = undefined;

  // Split VCD data into lines
  const lines = vcdData.split('\n');

  // Find the real minimum time step so that we can establish an apporpriate chunk size
  let previousTimeStamp = -9999999;
  let minTimeStemp      =  9999999;
  for (const line of lines) {
    const cleanedLine = line.trim();
    if (cleanedLine.startsWith('#')) {
      // Extract timestamp
      const timestampMatch = cleanedLine.match(/#(\d+)/);
      if (timestampMatch) {
        const currentTimestamp = parseInt(timestampMatch[1]);
        minTimeStemp      = Math.min(currentTimestamp - previousTimeStamp, minTimeStemp);
        previousTimeStamp = currentTimestamp;
      }
    }
  }

  waveformDataSet.chunkTime   = (BASE_CHUNK_TIME_WINDOW * minTimeStemp) / 4;
  waveformDataSet.defaultZoom = BASE_CHUNK_TIME_WINDOW / waveformDataSet.chunkTime;
  console.log("minTimeStemp = " + minTimeStemp);
  console.log("chunkTime = " + waveformDataSet.chunkTime);
  console.log("defaultZoom = " + waveformDataSet.defaultZoom);

  for (const line of lines) {
    // Remove leading and trailing whitespace
    const cleanedLine = line.trim();

    if (cleanedLine.startsWith('$scope')) {
      currentMode = 'scope';
      // Extract the current scope
      const scopeMatch = cleanedLine.match(/\s+module\s+(\w+)/);
      if (scopeMatch) {
        const newScope    = new NetlistItem(scopeMatch[1], 'module', 0, '', '', [], vscode.TreeItemCollapsibleState.Expanded);
        newScope.iconPath = new vscode.ThemeIcon('chip', new vscode.ThemeColor('charts.purple'));
        if (currentScope) {
          currentScope.children.push(newScope); // Add the new scope as a child of the current scope
        } else {
          netlistItems.push(newScope); // If there's no current scope, add it to the netlistItems
        }
        // Push the new scope onto the stack and set it as the current scope
        stack.push(newScope);
        currentScope = newScope;
      }
    } else if (cleanedLine.startsWith('$upscope')) {
      stack.pop(); // Pop the current scope from the stack
      currentScope = stack[stack.length - 1]; // Update the current scope to the parent scope
    } else if (cleanedLine.startsWith('$var')) {
      // Extract signal information (signal type and name)
      const varMatch = cleanedLine.match(/\$var\s+(wire|reg|integer|parameter|real)\s+(1|[\d+:]+)\s+(\w+)\s+(\w+(\[\d+)?(:\d+)?\]?)\s\$end/);
      if (varMatch && currentScope) {
        const varData             = cleanedLine.split(/\s+/);
        const signalType          = varMatch[1];
        const signalSize          = parseInt(varMatch[2], 10);
        const signalID            = varMatch[3];
        const signalNameWithField = varMatch[4];
        const signalName          = signalNameWithField.split('[')[0];
        if (signalName !== currentSignal) {
          // Create a NetlistItem for the signal and add it to the current scope
          const signalItem = new NetlistItem(signalNameWithField, signalType, signalSize, signalID, signalName, [], vscode.TreeItemCollapsibleState.None, vscode.TreeItemCheckboxState.Unchecked);

          // Assign an icon to the signal based on its type
          if (signalType === 'wire') {
            signalItem.iconPath = new vscode.ThemeIcon('symbol-interface', new vscode.ThemeColor('charts.pink'));
          } else if (signalType === 'reg') {
              signalItem.iconPath = new vscode.ThemeIcon('database', new vscode.ThemeColor('charts.green'));
          } else if (signalType === 'integer') {
              signalItem.iconPath = new vscode.ThemeIcon('symbol-variable', new vscode.ThemeColor('charts.blue'));
          } else if (signalType === 'parameter') {
              signalItem.iconPath = new vscode.ThemeIcon('symbol-property', new vscode.ThemeColor('charts.orange'));
          } else if (signalType === 'real') {
              signalItem.iconPath = new vscode.ThemeIcon('symbol-constant', new vscode.ThemeColor('charts.purple'));
          }
          currentScope.children.push(signalItem);
        }
        currentSignal    = signalName;
        waveformDataSet.createSignalWaveform(signalNameWithField, signalID, signalSize);
      }
    // Parse out waveform data
    } else if (cleanedLine.startsWith('#')) {
      // Extract timestamp
      const timestampMatch = cleanedLine.match(/#(\d+)/);
      if (timestampMatch) {
        currentTimestamp  = parseInt(timestampMatch[1]);
      }
    } else if (cleanedLine.startsWith('b')) {
      // Extract signal value
      const valueMatch = cleanedLine.match(/b([01xzXZ]*)\s+(\w+)/);
      if (valueMatch) {
        const signalValue = valueMatch[1];
        const signalId    = valueMatch[2];

        if (currentTimestamp !== 0) {
          initialState = signalValues.get(signalId) || "x";
          waveformDataSet.addTransitionData(signalId, [currentTimestamp, signalValue], initialState);
        } else {
          waveformDataSet.setInitialState(signalId, signalValue);
        }
        // Update the state of the signal in the map
        signalValues.set(signalId, signalValue);
      }
    } else if (cleanedLine.startsWith('0') || cleanedLine.startsWith('1')) {
      // Extract signal value
      const valueMatch = cleanedLine.match(/([01xzXZ])(\w+)/);
      if (valueMatch) {
        const signalValue = valueMatch[1];
        const signalId    = valueMatch[2];

        if (currentTimestamp !== 0) {
          initialState = signalValues.get(signalId) || "x";
          waveformDataSet.addTransitionData(signalId, [currentTimestamp, signalValue], initialState);
        } else {
          waveformDataSet.setInitialState(signalId, signalValue);
        }
        // Update the state of the signal in the map
        signalValues.set(signalId, signalValue);
      }
    } else if (cleanedLine.startsWith('$timescale')) {
      currentMode = 'timescale';
    } else if (cleanedLine.startsWith('$end')) {
      currentMode = undefined;
    }

    if (currentMode === 'timescale') {
      const timescaleMatch = cleanedLine.match(/(\d+)\s+(\w+)/);
      if (timescaleMatch) {
        waveformDataSet.timeScale = parseInt(timescaleMatch[1]);
        waveformDataSet.timeUnit  = timescaleMatch[2];
      }
    }
  }

  waveformDataSet.timeEnd = currentTimestamp + 1;
  signalValues.forEach((initialState, signalId) => {
    waveformDataSet.addTransitionData(signalId, [currentTimestamp, "x"], initialState);
  });

  // Update the Netlist view with the parsed netlist data
  netlistTreeDataProvider.setTreeData(netlistItems);
}

export function activate(context: vscode.ExtensionContext) {

  const viewerProvider = new WaveformViewerProvider(context);

  // Associates .vcd files with vaporview extension
  // See package.json for more details
  vscode.window.registerCustomEditorProvider(
    'vaporview.waveformViewer',
    viewerProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    });

  // Commands

  // Register a command to open the VaporView Sidebar
  context.subscriptions.push(vscode.commands.registerCommand('vaporview.viewVaporViewSidebar', () => {
    vscode.commands.executeCommand('workbench.view.extension.vaporView');
  }));
}

export default WaveformViewerProvider;

export function deactivate() {}

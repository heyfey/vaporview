// Description: This file contains the extension logic for the VaporView extension
// This code was generated by ChatGPT 3.5 with a sequence of guided prompts

import * as vscode from 'vscode';
import * as path from 'path';
import { on } from 'process';

class ActivityBarTreeDataProvider implements vscode.TreeDataProvider<ActivityBarItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ActivityBarItem | undefined> = new vscode.EventEmitter<ActivityBarItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<ActivityBarItem | undefined> = this._onDidChangeTreeData.event;

  getTreeItem(element: ActivityBarItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ActivityBarItem): Thenable<ActivityBarItem[]> {
    if (element) {
      // In this example, there are no child items, but you can define them as needed.
      return Promise.resolve([]);
    } else {
      // Create and return top-level items
      return Promise.resolve([
        new ActivityBarItem('Item 1', vscode.TreeItemCollapsibleState.None),
        new ActivityBarItem('Item 2', vscode.TreeItemCollapsibleState.None),
        // Add more items as needed
      ]);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

class ActivityBarItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

class NetlistTreeDataProvider implements vscode.TreeDataProvider<NetlistItem> {
  private treeData: NetlistItem[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<NetlistItem | undefined> = new vscode.EventEmitter<NetlistItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<NetlistItem | undefined> = this._onDidChangeTreeData.event;

  // Method to set the tree data
  public setTreeData(netlistItems: NetlistItem[]) {
    this.treeData = netlistItems;
    this._onDidChangeTreeData.fire(undefined); // Trigger a refresh of the Netlist view
  }

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


// Function to parse a VCD file and update the Netlist view
async function parseVCDFile(vcdFilePath: string, netlistTreeDataProvider: NetlistTreeDataProvider, waveformDataSet: WaveformTop, waveformViewer: WaveformViewer) {
  try {
    // Read the VCD file using vscode.workspace.openTextDocument
    const vcdDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(vcdFilePath));

    // Get the content of the document
    const vcdContent = vcdDocument.getText();

    waveformDataSet.filename = vcdFilePath;

    // Parse the VCD data for this specific file
    parseVCDData(vcdContent, netlistTreeDataProvider, waveformDataSet);
    console.log(waveformDataSet.netlistElements);
    // Optionally, you can refresh the Netlist view
    netlistTreeDataProvider.refresh();

    // Send a message to the webview to indicate that the VCD file is parsed
    waveformViewer.createTimeRuler();

  } catch (error: any) {
    vscode.window.showErrorMessage('Error reading the VCD file: ' + error.message);
  }
}

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

  // Activity Bar

  // Create an Activity Bar element
  const activityBarItem = vscode.window.createTreeView('vaporView', {
    treeDataProvider: new ActivityBarTreeDataProvider(),
  });
  context.subscriptions.push(activityBarItem);

  // Views

  // Create and register the Netlist view container
  const netlistTreeDataProvider = new NetlistTreeDataProvider();
  const netlistView = vscode.window.createTreeView('netlistContainer', {
    treeDataProvider: netlistTreeDataProvider,
  });
  context.subscriptions.push(netlistView);

  const displayedSignalsTreeDataProvider = new DisplayedSignalsViewProvider();
  const displayedSignalsView = vscode.window.createTreeView('displaylistContainer', {
    treeDataProvider: displayedSignalsTreeDataProvider,
  });
  context.subscriptions.push(displayedSignalsView);

  // Status Bar
  const waveformDataSet = new WaveformTop();

  // Create a status bar item for cursor time
  const cursorTimeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  // Create a status bar item for selected signal
  const selectedSignalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  // Commands

  // Register a command to open the VaporView Sidebar
  context.subscriptions.push(vscode.commands.registerCommand('vaporview.viewVaporViewSidebar', () => {
    vscode.commands.executeCommand('workbench.view.extension.vaporView');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vaporview.viewWaveform', async () => {

    // Create and show a webview panel for the waveform viewer
    //TODO: create a more elegant caching solution for the webview panel
    const panel = vscode.window.createWebviewPanel(
      'vaporView',
      'VaporView - Waveform Viewer',
      vscode.ViewColumn.One,
      {
        retainContextWhenHidden: true,
        enableScripts:           true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
        ]
      }
    );

    // Create an instance of the WaveformViewer class and pass your WaveformTop object
    const waveformViewer = new WaveformViewer(panel, context, waveformDataSet, cursorTimeStatusBarItem, selectedSignalStatusBarItem);

    // Subscribe to the checkbox state change event
    netlistView.onDidChangeCheckboxState((changedItem) => {
      const metadata = changedItem.items[0][0];
      const signalId = metadata.signalId;
    
      if (metadata.checkboxState === vscode.TreeItemCheckboxState.Checked) {
        waveformViewer.renderSignal(signalId);
      } else if (metadata.checkboxState === vscode.TreeItemCheckboxState.Unchecked) {
        waveformViewer.removeSignal(signalId);
      }
    });

    // Prompt the user to select a .vcd file
    const vcdFile = await vscode.window.showOpenDialog({
      openLabel: 'Open .vcd File',
      filters: {
        'VCD Files': ['vcd'],
        'All Files': ['*'],
      },
    });

    if (!vcdFile || vcdFile.length === 0) {
      vscode.window.showInformationMessage('No .vcd file selected.');
      return;
    }

    // vcdFile[0] is the user's selected .vcd file
    const selectedVcdFilePath = vcdFile[0].fsPath;

    // Call a function to parse the VCD file and update the Netlist view
    parseVCDFile(selectedVcdFilePath, netlistTreeDataProvider, waveformDataSet, waveformViewer);

    panel.onDidChangeViewState((e) => {
      console.log("onDidChangeViewState()");
      console.log(e);
    });

    panel.onDidDispose(() => {
      console.log("panel.onDidDispose()");
      // When the panel is closed, clear out the netlist data
      netlistTreeDataProvider.setTreeData([]);
      waveformViewer.dispose();
    });

  }));
}

class WaveformViewer {
  private readonly panel:   vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private waveformDataSet:  WaveformTop;
  private webAssets: {
    diamondUri:   vscode.Uri;
    svgIconsUri:  vscode.Uri;
    jsFileUri:    vscode.Uri;
    cssFileUri:   vscode.Uri;
    testImageUri: vscode.Uri;
    clusterize?:  vscode.Uri;
    codiconsUri:  vscode.Uri;
  };
  //private webAssets: { jsFileUri: string; cssFileUri: string; testImageUri: string;};

  constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, waveformDataSet: WaveformTop, cursorTimeStatusBarItem: vscode.StatusBarItem, selectedSignalStatusBarItem: vscode.StatusBarItem) {

    this.panel   = panel;
    this.context = context;
    this.waveformDataSet = waveformDataSet;

    const webview      = this.panel.webview;
    const extensionUri = this.context.extensionUri;

    this.webAssets = {
      diamondUri:   webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'diamond.svg')),
      svgIconsUri:  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'icons.svg')),
      jsFileUri:    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vaporview.js')),
      cssFileUri:   webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css')),
      testImageUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'wave_temp.png')),
      clusterize:   webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'clusterize_mod.js')),
      codiconsUri:  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')),
    };

    // Send the 'init' message when the webview is created
    this.panel.webview.postMessage({ command: 'init' });

    // Set the HTML content (should be your initial loading content)
    this.panel.webview.html = this.getWebViewContent();

    // set up the message listener
    this.panel.webview.onDidReceiveMessage((message) => {

      switch (message.command) {
        case 'init': {
          // Webview is initialized, send the 'init' message
        }
        case 'deleteSignal': {
          // Receive a request to render a signal
          const signalId = message.signalId;
          //netlistTreeDataProvider.toggleCheckboxState();
          //this.renderSignal(signalId);
          break;
        }
        case 'setTime': {
          if (message.time !== null) {
            cursorTimeStatusBarItem.text = 'time: ' + message.time + ' ' + this.waveformDataSet.timeUnit;
            cursorTimeStatusBarItem.show();
          } else {
            cursorTimeStatusBarItem.hide();
          }
          break;
        }
        case 'setSelectedSignal': {
          if (message.signalId !== null) {
            selectedSignalStatusBarItem.show();
            const signalName = this.waveformDataSet.netlistElements.get(message.signalId)?.name;
            selectedSignalStatusBarItem.text = 'Selected signal: ' + signalName;
          } else {
            selectedSignalStatusBarItem.hide();
          }
          break;
        }
        case 'close-webview' : {
          // Close the webview
          this.panel.dispose();
          break;
        }
      }
    });
  }

  createTimeRuler() {
    // Create and append the time ruler to the viewer
    // Customize and append the time ruler elements
    this.panel.webview.postMessage({ 
      command: 'create-ruler',
      waveformDataSet: this.waveformDataSet
   });
  }

  private showBasicLayout() {
    // Create and display the basic layout for the waveform viewer
  }

  renderSignal(signalId: string) {
    // Render the signal with the provided ID
    this.panel.webview.postMessage({ 
      command: 'render-signal',
      waveformData: this.waveformDataSet.netlistElements.get(signalId),
      signalId: signalId
   });
  }

  removeSignal(signalId: string) {
    // Render the signal with the provided ID
    this.panel.webview.postMessage({ 
      command: 'remove-signal',
      signalId: signalId
   });
  }

  private getWebViewContent() {

    // Generate the HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>VaporView - Waveform Viewer</title>
        <link rel="stylesheet" href="${this.webAssets.codiconsUri}"/>
        <link rel="stylesheet" href="${this.webAssets.cssFileUri}">
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${this.webAssets.diamondUri}" rel="diamond.svg" type="image/svg+xml">
        <link href="${this.webAssets.svgIconsUri}" rel="icons.svg" type="image/svg+xml">
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
                  <path d="M 2 14 L 2 14 L 8 14 L 8 3 C 8 1 8 1 10 1 L 14 1 L 14 2 L 9 2 L 9 13 C 9 15 9 15 7 15 L 2 15 L 2 14">
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
              <div class="control-bar-button" title="Go To Previous Transition (Ctrl + )" id="previous-edge-button">
                <svg class="custom-icon" viewBox="0 0 16 16"><use href="#previous-edge"/></svg>
              </div>
              <div class="control-bar-button" title="Go To Next Transition (Ctrl + )" id="next-edge-button">
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
          <div id="resize-1" class="resize-bar"></div>
          <div id="transition-display-container" class="labels-container">
            <div class="ruler-spacer"></div>
            <div id="transition-display"></div>
          </div>
          <div id="resize-2" class="resize-bar"></div>
          <div id="scrollArea" class="clusterize-scroll">
            <div id="contentArea" class="clusterize-content">
              <div class="clusterize-no-data">Loading data…</div>
            </div>
          </div>
        </div>
        <script src="${this.webAssets.clusterize}"></script>
        <script src="${this.webAssets.jsFileUri}"></script>
      </body>
      </html>
    `;

    return htmlContent;
  }

  public dispose() {
    console.log("waveformViewer.dispose()");
    this.waveformDataSet.dispose();
    this.context.subscriptions.pop();
  }
}

export default WaveformViewer;

export function deactivate() {}


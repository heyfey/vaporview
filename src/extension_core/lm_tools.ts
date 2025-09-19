import * as vscode from 'vscode';

interface IOpenFileParams {
  uri: string;
  loadAll?: boolean;
  maxSignals?: number;
}

export class OpenFileTool implements vscode.LanguageModelTool<IOpenFileParams> {
  async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IOpenFileParams>, _token: vscode.CancellationToken) {
    const loadAllText = options.input.loadAll ? ' (loading all variables)' : '';
    const maxSignalsText = options.input.maxSignals ? ` (max signals: ${options.input.maxSignals})` : '';
    return {
      invocationMessage: `Opening file "${options.input.uri}" in VaporView${loadAllText}${maxSignalsText}...`,
      confirmationMessages: {
        title: 'Confirm Open File',
        message: new vscode.MarkdownString(`Open the waveform dump file **${options.input.uri}** in VaporView?${options.input.loadAll ? ' Load all variables?' : ''}${options.input.maxSignals ? ` Max signals: **${options.input.maxSignals}**` : ''}`)
      }
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<IOpenFileParams>, _token: vscode.CancellationToken) {
    try {
      // Validate required uri
      if (!options.input.uri) {
        throw new Error('URI is required for opening a file');
      }
      // Parse the string URI to vscode.Uri for compatibility with vscode.openWith
      const parsedUri = vscode.Uri.file(options.input.uri);
      const args = {
        ...options.input,
        uri: parsedUri
      };
      await vscode.commands.executeCommand('vaporview.openFile', args);
      const loadAllText = options.input.loadAll ? ' (all variables loaded)' : '';
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Successfully opened file "${options.input.uri}" in VaporView${loadAllText}.`)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error opening file: ${message}`)]);
    }
  }
}

interface IAddVariableParams {
    uri?: string;
    netlistId?: string;
    instancePath?: string;
    scopePath?: string;
    name?: string;
    msb?: number;
    lsb?: number;
}

export class AddVariableTool implements vscode.LanguageModelTool<IAddVariableParams> {
    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IAddVariableParams>, _token: vscode.CancellationToken) {
        const varDetails = options.input.name || options.input.instancePath || options.input.netlistId || 'specified variable';
        return {
            invocationMessage: `Adding variable "${varDetails}" to waveform viewer...`,
            confirmationMessages: {
                title: 'Confirm Add Variable',
                message: new vscode.MarkdownString(`Add the variable **${varDetails}** to the active waveform viewer?`)
            }
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<IAddVariableParams>, _token: vscode.CancellationToken) {
        try {
            // Validate that at least one variable specifier is provided
            if (!options.input.netlistId && !options.input.instancePath && (!options.input.scopePath || !options.input.name)) {
                throw new Error('Must specify at least one of: netlistId, instancePath, or (scopePath AND name)');
            }
            await vscode.commands.executeCommand('waveformViewer.addVariable', options.input);
            const varDetails = options.input.name || options.input.instancePath || options.input.netlistId || 'the variable';
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Successfully added variable "${varDetails}" to the waveform viewer.`)]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred';
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error adding variable: ${message}`)]);
        }
    }
}

interface IRemoveVariableParams {
    uri?: string;
    netlistId?: string;
    instancePath?: string;
    scopePath?: string;
    name?: string;
    msb?: number;
    lsb?: number;
}

export class RemoveVariableTool implements vscode.LanguageModelTool<IRemoveVariableParams> {
    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IRemoveVariableParams>, _token: vscode.CancellationToken) {
        const varDetails = options.input.name || options.input.instancePath || options.input.netlistId || 'specified variable';
        return {
            invocationMessage: `Removing variable "${varDetails}" from waveform viewer...`,
            confirmationMessages: {
                title: 'Confirm Remove Variable',
                message: new vscode.MarkdownString(`Remove the variable **${varDetails}** from the active waveform viewer?`)
            }
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<IRemoveVariableParams>, _token: vscode.CancellationToken) {
        try {
            // Validate that at least one variable specifier is provided
            if (!options.input.netlistId && !options.input.instancePath && (!options.input.scopePath || !options.input.name)) {
                throw new Error('Must specify at least one of: netlistId, instancePath, or (scopePath AND name)');
            }
            await vscode.commands.executeCommand('waveformViewer.removeVariable', options.input);
            const varDetails = options.input.name || options.input.instancePath || options.input.netlistId || 'the variable';
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Successfully removed variable "${varDetails}" from the waveform viewer.`)]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred';
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error removing variable: ${message}`)]);
        }
    }
}

interface IPlaceMarkerParams {
    time: number;
    markerType?: number; // 0 for 'normal', 1 for 'alt'
    uri?: string;
    units?: string;
}

export class PlaceMarkerTool implements vscode.LanguageModelTool<IPlaceMarkerParams> {
    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IPlaceMarkerParams>, _token: vscode.CancellationToken) {
        return {
            invocationMessage: `Placing ${options.input.markerType === 1 ? 'alt-' : ''}marker at time ${options.input.time}...`,
            confirmationMessages: {
                title: 'Confirm Place Marker',
                message: new vscode.MarkdownString(`Place a ${options.input.markerType === 1 ? 'alt-' : ''}marker at time **${options.input.time}** in the waveform viewer?`)
            }
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<IPlaceMarkerParams>, _token: vscode.CancellationToken) {
        try {
            await vscode.commands.executeCommand('waveformViewer.setMarker', options.input);
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Successfully placed ${options.input.markerType === 1 ? 'alt-' : ''}marker at time ${options.input.time}.`)]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred';
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error placing marker: ${message}`)]);
        }
    }
}

interface IRevealItemParams {
  uri?: string;
  netlistId?: string;
  instancePath?: string;
  scopePath?: string;
  name?: string;
}

export class RevealItemTool implements vscode.LanguageModelTool<IRevealItemParams> {
  async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IRevealItemParams>, _token: vscode.CancellationToken) {
    const itemDetails = options.input.name || options.input.instancePath || options.input.netlistId || 'specified item';
    return {
      invocationMessage: `Revealing item "${itemDetails}" in netlist...`,
      confirmationMessages: {
        title: 'Confirm Reveal Item',
        message: new vscode.MarkdownString(`Reveal the item **${itemDetails}** in the netlist view?`)
      }
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<IRevealItemParams>, _token: vscode.CancellationToken) {
    try {
      // Validate that at least one item specifier is provided
      if (!options.input.netlistId && !options.input.instancePath && (!options.input.scopePath || !options.input.name)) {
        throw new Error('Must specify at least one of: netlistId, instancePath, or (scopePath AND name)');
      }
      await vscode.commands.executeCommand('waveformViewer.revealInNetlistView', options.input);
      const itemDetails = options.input.name || options.input.instancePath || options.input.netlistId || 'the item';
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Successfully revealed item "${itemDetails}" in the netlist.`)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error revealing item: ${message}`)]);
    }
  }
}

interface IGetValuesAtTimeParams {
  uri?: string;
  time?: number;
  instancePaths: string[];
}

export class GetValuesAtTimeTool implements vscode.LanguageModelTool<IGetValuesAtTimeParams> {
  async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IGetValuesAtTimeParams>, _token: vscode.CancellationToken) {
    const pathsText = options.input.instancePaths.join(', ');
    const timeText = options.input.time !== undefined ? ` at time ${options.input.time}` : ' at marker time';
    return {
      invocationMessage: `Getting values for paths [${pathsText}]${timeText}...`,
      confirmationMessages: {
        title: 'Confirm Get Values at Time',
        message: new vscode.MarkdownString(`Retrieve values for instance paths **${pathsText}**${timeText} in the waveform viewer?`)
      }
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<IGetValuesAtTimeParams>, _token: vscode.CancellationToken) {
    try {
      // Validate required instancePaths
      if (!options.input.instancePaths || options.input.instancePaths.length === 0) {
        throw new Error('instancePaths array is required and must not be empty');
      }
      const result = await vscode.commands.executeCommand('waveformViewer.getValuesAtTime', options.input);
      // Format the result array for output
      let formattedResult = 'Values retrieved:\n';
      if (Array.isArray(result)) {
        result.forEach((item: any) => {
          const valueText = Array.isArray(item.value) ? `[${item.value.join(', ')}]` : item.value;
          formattedResult += `- ${item.instancePath}: ${valueText}\n`;
        });
      } else {
        formattedResult = 'No values found or unexpected result format.';
      }
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(formattedResult)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Error getting values at time: ${message}`)]);
    }
  }
}